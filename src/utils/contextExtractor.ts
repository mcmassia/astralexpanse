import { parse, HTMLElement } from 'node-html-parser';

export interface ContextSnippet {
    objectId: string; // The object where this snippet comes from
    content: string;  // The HTML content of the snippet
    timestamp: Date;  // To sort by date
}

/**
 * Extracts rich context from HTML content where a specific object is mentioned.
 * It captures the paragraph/block containing the mention, and optionally
 * any immediately following list (ul/ol) to capture "bulleted info below".
 *
 * @param html The full HTML content of the source object
 * @param targetId The ID of the object being mentioned (to look for)
 * @returns Array of HTML strings representing the context snippets
 */
export const extractContext = (html: string, targetId: string): string[] => {
    if (!html || !targetId) return [];

    const root = parse(html);
    const snippets: string[] = [];
    const seenNodes = new Set<HTMLElement>();

    // 1. Find all mentions/links to the target ID
    // We look for:
    // - <span data-mention-id="targetId">
    // - <a href="object:targetId">
    // - <span data-hashtag-id="targetId">
    // - <span data-task-id="targetId"> (maybe?)

    const mentions = root.querySelectorAll(`
        span[data-mention-id="${targetId}"],
        a[href="object:${targetId}"],
        span[data-hashtag-id="${targetId}"]
    `);

    mentions.forEach(mention => {
        // Find the block container (p, li, h1-h6, div)
        // We traverse up until we find a block-level element
        let container = mention.parentNode as HTMLElement;
        while (container && container.tagName && !isBlockElement(container.tagName)) {
            container = container.parentNode as HTMLElement;
        }

        if (!container || !container.tagName) return;

        // If we already processed this container (e.g. multiple mentions in same paragraph), skip
        if (seenNodes.has(container)) return;

        let contextHtml = container.outerHTML;
        seenNodes.add(container);

        // CHECK NEXT SIBLING FOR LISTS
        // If the container is NOT a list item itself, check if the *next* element is a list
        // This covers the "information contained in bullets below" requirement
        if (container.tagName !== 'LI') {
            let nextSibling = container.nextElementSibling;

            // Allow skipping empty text nodes or <br> if node-html-parser handled them as nodes (it mostly handles elements)
            // In node-html-parser, nextElementSibling gives the next Element.

            if (nextSibling && (nextSibling.tagName === 'UL' || nextSibling.tagName === 'OL')) {
                contextHtml += nextSibling.outerHTML;
                seenNodes.add(nextSibling); // Mark list as seen so we don't duplicate if a mention is IN the list too? 
                // Actually, if a mention is IN the list, we might want to show the list item. 
                // But if we show the WHOLE list as context for the paragraph, we probably don't need to show individual items again?
                // For now, let's just append it.
            }
        }
        // If the container IS a list item (LI), we usually want to show the whole LI.
        // And potentially nested lists provided they are children of the LI.
        // node-html-parser's outerHTML of an LI *includes* its children, so nested <ul> inside <li> are already included!

        snippets.push(contextHtml);
    });

    return snippets;
};

const isBlockElement = (tagName: string): boolean => {
    return ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE', 'PRE'].includes(tagName.toUpperCase());
};
