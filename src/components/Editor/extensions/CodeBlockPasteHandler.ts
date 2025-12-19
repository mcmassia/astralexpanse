// CodeBlockPasteHandler - Custom ProseMirror plugin to handle multi-line paste in code blocks
// This fixes the known TipTap issue where pasting multi-line text into code blocks
// only inserts the first line and creates paragraphs for the rest.
// Also handles pasting HTML content that contains code blocks.

import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Extension } from '@tiptap/core';

/**
 * Transforms HTML content to preserve newlines in code blocks
 * TipTap has issues parsing pre/code elements with newlines, so we
 * need to pre-process the HTML to ensure newlines are preserved.
 */
function transformHtmlCodeBlocks(html: string): string {
    // Create a temporary DOM parser
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Find all pre and code elements
    const preElements = doc.querySelectorAll('pre');

    preElements.forEach(pre => {
        // Get the text content preserving whitespace
        const codeElement = pre.querySelector('code') || pre;
        const textContent = codeElement.textContent || '';

        // If there are newlines, we need to preserve them
        if (textContent.includes('\n')) {
            // Replace the content with a structure that TipTap will parse correctly
            // Each line becomes a separate text node with proper breaks
            const lines = textContent.split('\n');

            // Clear the code element
            codeElement.innerHTML = '';

            // Add each line with explicit newline characters
            lines.forEach((line, index) => {
                const textNode = doc.createTextNode(line);
                codeElement.appendChild(textNode);
                if (index < lines.length - 1) {
                    // Add newline as text node (not <br>)
                    codeElement.appendChild(doc.createTextNode('\n'));
                }
            });
        }
    });

    return doc.body.innerHTML;
}

export const CodeBlockPasteHandler = Extension.create({
    name: 'codeBlockPasteHandler',

    addProseMirrorPlugins() {
        const extensionThis = this;

        return [
            new Plugin({
                key: new PluginKey('codeBlockPasteHandler'),
                props: {
                    handlePaste: (view, event) => {
                        const { state } = view;
                        const { selection } = state;
                        const { $from } = selection;

                        // Case 1: Pasting inside a code block - insert as plain text
                        const isInCodeBlock = $from.parent.type.name === 'codeBlock';
                        if (isInCodeBlock) {
                            const text = event.clipboardData?.getData('text/plain');
                            if (!text) {
                                return false;
                            }

                            event.preventDefault();
                            const tr = state.tr.insertText(text, selection.from, selection.to);
                            view.dispatch(tr);
                            return true;
                        }

                        // Case 2: Pasting HTML content that might contain code blocks
                        const html = event.clipboardData?.getData('text/html');
                        if (html && (html.includes('<pre') || html.includes('<code'))) {
                            // Transform the HTML to preserve code block newlines
                            const transformedHtml = transformHtmlCodeBlocks(html);

                            // Only intervene if we actually transformed something
                            if (transformedHtml !== html) {
                                event.preventDefault();

                                // Use the editor's insertContent command with the transformed HTML
                                const editor = (extensionThis as any).editor;
                                if (editor) {
                                    editor.commands.insertContent(transformedHtml, {
                                        parseOptions: {
                                            preserveWhitespace: 'full',
                                        },
                                    });
                                    return true;
                                }
                            }
                        }

                        return false; // Let other handlers process it
                    },
                },
            }),
        ];
    },
});
