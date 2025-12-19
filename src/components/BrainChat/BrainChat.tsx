import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader2, Save } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useObjectStore } from '../../stores/objectStore';
import { useAIStore } from '../../stores/aiStore';
import { useCalendarStore } from '../../stores/calendarStore';
import type { ChatMessage } from '../../types/ai';
import { useUIStore } from '../../stores/uiStore';
import { aiService } from '../../services/ai';
import { collectionGroup, getDocs, query, where, limit } from 'firebase/firestore'; // Firestore imports
import { getFirestoreDb, initializeFirebase } from '../../services/firebase'; // Firestore instance
import { marked } from 'marked';
import { useToast } from '../common';
import './BrainChat.css';

// Cosine similarity
const cosineSimilarity = (vecA: number[], vecB: number[]) => {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

export const BrainChat = () => {
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [retryStatus, setRetryStatus] = useState<{ isRetrying: boolean; attempt: number; reason: string } | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const { objects, objectTypes, createObject, updateObject } = useObjectStore();
    const { isEnabled, apiKey, chatHistory, addChatMessage, loadChatFromFirestore, saveChatToFirestore, subscribeToFirestore, getContextFromCache, addContextCacheEntry } = useAIStore();
    const { setCurrentSection, pushNavHistory } = useUIStore();

    // Get current user for Firestore persistence
    const { auth } = initializeFirebase();
    const userId = auth.currentUser?.uid;

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [chatHistory, isLoading]);

    // Load chat history from Firestore on mount
    useEffect(() => {
        if (userId) {
            loadChatFromFirestore(userId);
            const unsubscribe = subscribeToFirestore(userId);
            return () => unsubscribe();
        }
    }, [userId, loadChatFromFirestore, subscribeToFirestore]);

    // Save chat to Firestore whenever it changes (debounced via length check)
    useEffect(() => {
        if (userId && chatHistory.length > 1) {
            saveChatToFirestore(userId);
        }
    }, [chatHistory.length, userId, saveChatToFirestore]);

    // Handle clicking on "object:ID" links
    const handleMessageClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        // Handle clicks on the pill or its children
        const link = target.closest('a');
        if (link) {
            const href = link.getAttribute('href');
            if (href && href.startsWith('object:')) {
                e.preventDefault();
                const objectId = href.split(':')[1];

                // Navigate to object
                pushNavHistory('chat', null);

                // 2. Switch to object view
                useObjectStore.getState().selectObject(objectId);
                setCurrentSection('objects');
            }
        }
    };

    const renderContent = (content: string) => {
        const renderer = new marked.Renderer();
        const originalLink = renderer.link.bind(renderer);

        // @ts-ignore - Catch-all for marked signature mismatches
        renderer.link = (optionOrHref: any, title?: string, text?: string) => {
            // Check if first arg is an object (Marked 5.x+) or string (older)
            let href = typeof optionOrHref === 'string' ? optionOrHref : optionOrHref?.href;

            if (href && href.startsWith('object:')) {
                const objectId = href.split(':')[1];
                const obj = objects.find(o => o.id === objectId);

                if (obj) {
                    const typeConfig = objectTypes.find(t => t.id === obj.type);
                    const color = typeConfig?.color || '#a855f7';
                    const typeName = typeConfig?.name?.toUpperCase() || obj.type.toUpperCase();
                    const iconName = typeConfig?.icon || 'FileText';

                    // Render Icon (Lucide or Emoji)
                    let iconHtml = iconName;
                    const IconComponent = (LucideIcons as any)[iconName];
                    if (IconComponent) {
                        iconHtml = renderToStaticMarkup(<IconComponent size={14} strokeWidth={2.5} />);
                    }

                    return `
                        <a href="${href}" class="object-link-pill" title="${obj.title}">
                            <span class="obj-type-badge" style="background-color: ${color}">${typeName}</span>
                            <span class="obj-content">${iconHtml} <span class="obj-text">${obj.title}</span></span>
                        </a>
                    `;
                }
            }

            // Fallback to original
            if (typeof optionOrHref === 'string') {
                return (originalLink as any)(optionOrHref, title, text);
            }
            return originalLink(optionOrHref);
        };

        const html = marked.parse(content, { renderer }) as string;
        return <div dangerouslySetInnerHTML={{ __html: html }} onClick={handleMessageClick} />;
    };


    const toast = useToast();

    const handleSaveMsgObject = async (content: string) => {
        try {
            // Convert markdown content to HTML to preserve styles and links in the Editor
            // We use the same specific renderer logic? 
            // Actually, the Editor's extension expects <a href="object:...">.
            // marked.parse() will convert [Title](object:ID) to <a href="object:ID">Title</a>
            // This is exactly what the Editor needs.
            const htmlContent = await marked.parse(content);

            // createObject(type, title, content, autoSelect, initialProperties)
            const newObj = await createObject(
                'note',
                'AI Chat Insight',
                htmlContent as string, // Ensure it's string
                false
            );

            // Add tags separately since createObject signature doesn't support them
            await updateObject(newObj.id, { tags: ['#ai-generated'] });

            toast.success('Nota guardada', 'La respuesta se ha guardado como una nueva nota.');
        } catch (e) {
            console.error(e);
            toast.error('Error', 'No se pudo guardar la nota.');
        }
    };

    const handleSend = async () => {
        if (!input.trim() || !isEnabled || !apiKey || isLoading) return;

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            timestamp: Date.now()
        };

        addChatMessage(userMsg);
        setInput('');
        setIsLoading(true);

        try {

            // --- ADVANCED PKM RAG (4-PILLAR STRATEGY) ---

            // 1. SELF-QUERYING ROUTER (Intent & Filters)
            let analysis;
            try {
                analysis = await aiService.analyzeQuery(userMsg.content);
                console.log('[BrainChat] Router Analysis:', analysis);

                // POST-PROCESS: Fuzzy match router tags against actual object titles
                // The router may return incorrect tags; correct them here
                if (analysis.filters.tags && analysis.filters.tags.length > 0) {
                    const correctedTags: string[] = [];

                    for (const routerTag of analysis.filters.tags) {
                        const normalizedRouterTag = routerTag.toLowerCase();

                        // Also check the original query for the full tag mention
                        const queryLower = userMsg.content.toLowerCase();

                        // Find best matching object title
                        const bestMatch = objects.find(obj => {
                            const titleLower = obj.title.toLowerCase();
                            // Check if object title matches router tag or appears in query
                            return titleLower === normalizedRouterTag ||
                                titleLower.includes(normalizedRouterTag) ||
                                normalizedRouterTag.includes(titleLower) ||
                                queryLower.includes(titleLower);
                        });

                        if (bestMatch) {
                            correctedTags.push(bestMatch.title);
                            console.log(`[BrainChat] Tag corrected: "${routerTag}" → "${bestMatch.title}"`);
                        } else {
                            correctedTags.push(routerTag); // Keep original if no match
                        }
                    }

                    analysis.filters.tags = correctedTags;
                    console.log('[BrainChat] Corrected Tags:', correctedTags);
                } else {
                    // FALLBACK: Router returned no tags, but query/searchQuery may contain tag names
                    // Scan for object titles that appear in the query or searchQuery
                    const queryLower = userMsg.content.toLowerCase();
                    const searchLower = analysis.searchQuery.toLowerCase();

                    const foundTags: string[] = [];
                    for (const obj of objects) {
                        const titleLower = obj.title.toLowerCase();
                        // Check if title has at least 3 words to avoid false positives
                        const wordCount = titleLower.split(/\s+/).length;
                        if (wordCount >= 2 && (queryLower.includes(titleLower) || searchLower.includes(titleLower))) {
                            foundTags.push(obj.title);
                            console.log(`[BrainChat] Tag extracted from query: "${obj.title}"`);
                        }
                    }

                    if (foundTags.length > 0) {
                        analysis.filters.tags = foundTags;
                        console.log('[BrainChat] Extracted Tags:', foundTags);
                    }
                }
            } catch (e) {
                console.warn('[BrainChat] Router failed, using defaults');
                analysis = { filters: {}, searchQuery: userMsg.content, intent: 'search' };
            }

            // 2. PRE-FILTERING (Hard Filters)
            let filteredObjects = objects.filter(obj => {
                // Type Filter
                if (analysis.filters.type) {
                    const filterTypeTerm = analysis.filters.type.toLowerCase();
                    const objectTypes = useObjectStore.getState().objectTypes;

                    // Resolve filterTypeTerm to an actual objectType ID by matching name or namePlural
                    const matchedType = objectTypes.find(t =>
                        t.name.toLowerCase() === filterTypeTerm ||
                        t.namePlural.toLowerCase() === filterTypeTerm
                    );

                    if (matchedType) {
                        // Filter by the resolved ID
                        if (obj.type !== matchedType.id) return false;
                    } else {
                        // Fallback: if no type matched by name, try matching by ID directly (less likely)
                        if (obj.type.toLowerCase() !== filterTypeTerm) return false;
                    }
                }

                // Date Filter (Recency)
                if (analysis.filters.dateRange) {
                    const now = new Date();
                    const objDate = new Date(obj.updatedAt);
                    const diffDays = (now.getTime() - objDate.getTime()) / (1000 * 3600 * 24);

                    if (analysis.filters.dateRange === 'last_7_days' && diffDays > 7) return false;
                    if (analysis.filters.dateRange === 'last_30_days' && diffDays > 30) return false;
                }

                // Tag Filter - Check tags array, hashtags in content, AND inline ObjectLink references
                if (analysis.filters.tags && analysis.filters.tags.length > 0) {
                    const filterTags = analysis.filters.tags.map((t: string) => t.toLowerCase().replace(/^#/, ''));
                    const objTags = (obj.tags || []).map((t: string) => t.toLowerCase().replace(/^#/, ''));

                    // Extract hashtags from content (e.g., #Realizado)
                    const contentHashtags = (obj.content.match(/#[\w\-áéíóúñü]+/gi) || [])
                        .map((t: string) => t.toLowerCase().replace(/^#/, ''));

                    // Extract inline ObjectLink references (href="object:ID")
                    const objectLinkMatches = [...obj.content.matchAll(/href="object:([^"]+)"/gi)];
                    const linkedObjectIds = objectLinkMatches.map(m => m[1]);

                    // Get titles of ALL linked objects (to match tag names regardless of object type)
                    const linkedObjectTitles = linkedObjectIds
                        .map(id => objects.find(o => o.id === id))
                        .filter(o => o != null)
                        .map(o => o!.title.toLowerCase());

                    const allTags = [...objTags, ...contentHashtags, ...linkedObjectTitles];

                    // Check if any filter tag matches
                    const hasMatch = filterTags.some((ft: string) =>
                        allTags.some((at: string) => at.includes(ft) || ft.includes(at))
                    );
                    if (!hasMatch) return false;
                }

                return true;
            });

            if (filteredObjects.length === 0) {
                console.warn('[BrainChat] No objects matched filters. Reverting to full search.');
                filteredObjects = objects;
            }

            // 3. CHECK CONTEXT CACHE (skip if tags filter is present since they may have been corrected)
            const hasTags = analysis.filters.tags && analysis.filters.tags.length > 0;
            const cachedObjectIds = hasTags ? null : getContextFromCache(analysis.searchQuery);
            let scoredCandidates: { obj: any; score: number; reason: string }[] = [];

            if (cachedObjectIds && cachedObjectIds.length > 0) {
                console.log('[BrainChat] Cache HIT! Using cached context.');
                scoredCandidates = cachedObjectIds
                    .map(id => {
                        const obj = filteredObjects.find(o => o.id === id);
                        return obj ? { obj, score: 1, reason: 'cached' } : null;
                    })
                    .filter(Boolean) as { obj: any; score: number; reason: string }[];
            } else {
                // 4. VECTOR SEARCH + RECENCY WEIGHTING (Cache MISS)
                console.log('[BrainChat] Cache MISS. Performing full RAG.');

                try {
                    // NEW: SHADOW CHUNK RETRIEVAL STRATEGY
                    // If we have specific tags or distinct keywords, query the granular chunks first
                    let chunkCandidates: any[] = [];

                    if (hasTags) {
                        const firestore = getFirestoreDb();
                        // Normalize tags for query (must match objectStore cleaning)
                        const rawTags = analysis.filters.tags || [];
                        const tagsFilter = rawTags.map(t =>
                            t.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim()
                        );

                        console.log('[BrainChat] Querying Shadow Chunks for tags (normalized):', tagsFilter);
                        console.log('[BrainChat] Using collectionGroup: search_chunks');

                        // DEBUG: Log first few chunks blindly to see what they contain
                        // This helps debugging if the array-contains-any is failing due to formatting
                        getDocs(query(collectionGroup(firestore, 'search_chunks'), limit(5))).then(snap => {
                            snap.docs.forEach(d => console.log('[BrainChat-DEBUG] Chunk Sample:', d.data()));
                        });

                        const chunksQuery = query(
                            collectionGroup(firestore, 'search_chunks'),
                            where('tagsInBlock', 'array-contains-any', tagsFilter),
                            limit(20)
                        );

                        const chunkSnapshots = await getDocs(chunksQuery);
                        console.log(`[BrainChat] Found ${chunkSnapshots.size} matching chunks.`);

                        chunkCandidates = chunkSnapshots.docs.map(doc => {
                            const data = doc.data();
                            const parentObj = objects.find(o => o.id === data.parentId);
                            if (!parentObj) return null;

                            return {
                                obj: parentObj,
                                score: 0.95, // High score for direct tag match in chunk
                                reason: `chunk_tag_match: ${data.tagsInBlock.join(', ')}`,
                                focusedContent: data.content // Use the chunk content as the primary context
                            };
                        }).filter(Boolean);
                    }

                    // Merge chunk candidates with standard vector search (if needed or if chunks found nothing)
                    if (chunkCandidates.length > 0) {
                        scoredCandidates = chunkCandidates;
                    } else {
                        // Fallback to standard client-side search if no chunks found or no tags
                        let embeddingQuery = analysis.searchQuery;
                        // Add short-term history context
                        const recentMsgs = chatHistory.slice(-2).filter(m => m.role === 'user');
                        if (recentMsgs.length > 0) {
                            embeddingQuery += " " + recentMsgs.map(m => m.content).join(" ");
                        }

                        const embeddedQuery = await aiService.getEmbeddings(embeddingQuery);

                        scoredCandidates = filteredObjects
                            .map(obj => {
                                // ... existing scoring logic
                                if (!obj.embedding) return { obj, score: 0, reason: 'no_embedding' };
                                const similarity = cosineSimilarity(embeddedQuery, obj.embedding);
                                let score = similarity;

                                // Recency Boost
                                const created = new Date(obj.createdAt).getTime();
                                const now = Date.now();
                                const daysOld = (now - created) / (1000 * 60 * 60 * 24);
                                if (daysOld < 1) score += 0.15;
                                else if (daysOld < 7) score += 0.08;
                                else if (daysOld < 30) score += 0.04;

                                // Title Keyword Boost
                                if (embeddingQuery.toLowerCase().includes(obj.title.toLowerCase())) {
                                    score += 0.3;
                                }

                                return { obj, score, reason: 'semantic' };
                            })
                            .sort((a, b) => b.score - a.score)
                            .slice(0, 15);
                    }
                } catch (e) {
                    console.warn('Search failed:', e);
                }
            } // End of cache miss block

            // 4. GRAPH TRAVERSAL (Fetch Neighbors)
            const graphCandidates: typeof scoredCandidates = [];
            const processedIds = new Set(scoredCandidates.map(c => c.obj.id));

            scoredCandidates.forEach(candidate => {
                if (candidate.score > 0.75) {
                    if (candidate.obj.links) {
                        candidate.obj.links.forEach((linkId: string) => {
                            if (!processedIds.has(linkId)) {
                                const linkedObj = objects.find(o => o.id === linkId);
                                if (linkedObj) {
                                    graphCandidates.push({ obj: linkedObj, score: candidate.score * 0.9, reason: 'linked_to_result' });
                                    processedIds.add(linkId);
                                }
                            }
                        });
                    }
                    if (candidate.obj.backlinks) {
                        candidate.obj.backlinks.forEach((linkId: string) => {
                            if (!processedIds.has(linkId)) {
                                const linkedObj = objects.find(o => o.id === linkId);
                                if (linkedObj) {
                                    graphCandidates.push({ obj: linkedObj, score: candidate.score * 0.85, reason: 'backlink_to_result' });
                                    processedIds.add(linkId);
                                }
                            }
                        });
                    }
                }
            });

            // 5. MERGE & DEDUPLICATE with Focused Content handling
            const allCandidates = [...scoredCandidates, ...graphCandidates];
            const uniqueMap = new Map();
            allCandidates.forEach(c => {
                if (!uniqueMap.has(c.obj.id)) {
                    uniqueMap.set(c.obj.id, { ...c }); // Clone to avoid side effects
                } else {
                    // If we have multiple chunks for the same object, MERGE them.
                    const existing = uniqueMap.get(c.obj.id);
                    const newFocused = (c as any).focusedContent;

                    if (newFocused) {
                        if ((existing as any).focusedContent) {
                            // Append the new chunk to existing content
                            (existing as any).focusedContent += `\n\n[...]\n\n` + newFocused;
                        } else {
                            // Upgrade existing object to use this focused content
                            (existing as any).focusedContent = newFocused;
                            existing.score = Math.max(existing.score, c.score);
                        }
                    }
                }
            });

            const finalContextObjects = Array.from(uniqueMap.values())
                .sort((a, b: any) => b.score - a.score)
                .slice(0, 30);

            // Save context to cache for future queries
            const objectIdsForCache = finalContextObjects.map(c => c.obj.id);
            addContextCacheEntry(analysis.searchQuery, objectIdsForCache);

            // 5. CALENDAR EVENTS CONTEXT
            // We use the store directly to get synchronized events
            const calendarEvents = useCalendarStore.getState().events;
            const now = new Date();
            const relevantEvents = calendarEvents
                .filter(e => new Date(e.start) >= now || new Date(e.end) >= now) // Future or ongoing
                .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
                .slice(0, 50);

            const calendarContextString = relevantEvents.length > 0 ? `
CALENDAR EVENTS (Synchronized):
${relevantEvents.map(e => {
                const start = new Date(e.start).toLocaleString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
                return `- [${start}] ${e.summary}`;
            }).join('\n')}
` : '';

            // INJECTION: Updated Prompt for Links
            const typeCounts = objects.reduce((acc, obj) => {
                acc[obj.type] = (acc[obj.type] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            const metadataContext = `
SYSTEM METADATA:
Total Objects: ${objects.length}
Counts by Type: ${JSON.stringify(typeCounts)}
Current Date: ${new Date().toLocaleDateString()}

CRITICAL OUTPUT FORMATTING:
- When mentioning a specific object from the context, YOU MUST format it as a markdown link using its ID.
- The link format MUST be: [Object Title](object: OBJECT_ID)
    - Example: "[Project Alpha](object:12345)" or "[Meeting with John](object:67890)"
        - DO NOT show the raw ID in the text.
        - DO NOT include emojis or icons in the link text, only the title.
`;

            const contextDocs = [
                metadataContext,
                calendarContextString,
                ...finalContextObjects.map(c => {
                    const isFocus = c.score >= 3.0;
                    const charLimit = isFocus ? 8000 : 3000;

                    // Use focused content from chunk if available (Shadow Chunking), otherwise use full content
                    let contentToUse = (c as any).focusedContent || c.obj.content;

                    let cleanContent = contentToUse.replace(/<[^>]*>/g, ' ').trim();
                    if (!cleanContent) cleanContent = '(No text content - use Title/Properties to infer context)';

                    const props = c.obj.properties && Object.keys(c.obj.properties).length > 0
                        ? JSON.stringify(c.obj.properties)
                        : '(No custom properties)';

                    // Extract hashtags from content for visibility (used in effective tags)
                    // (c.obj.content.match(/#[\w\-áéíóúñü]+/gi) || [])

                    // Old linkedTitles logic removed in favor of unified logic below

                    // Extract inline ObjectLink references from content (e.g., TAG pills)
                    const inlineRefMatches = [...c.obj.content.matchAll(/href="object:([^"]+)"/gi)];
                    const inlineRefs = inlineRefMatches
                        .map(m => {
                            const refObj = objects.find(o => o.id === m[1]);
                            return refObj ? refObj.title : null;
                        })
                        .filter((v: string | null) => v != null) as string[];

                    const uniqueInlineRefs = [...new Set(inlineRefs)];
                    // inlineRefsString removed (unused)

                    // UNIFY ALL TAG SOURCES INTO A SINGLE "TAGS" FIELD TO FORCE AI COMPLIANCE

                    const rawTags = (c.obj.tags || []);
                    const extractedHashtags = (c.obj.content.match(/#[\w\-áéíóúñü]+/gi) || [])
                        .map((t: string) => t.replace('#', '')); // Remove # for cleaner list

                    // Extract relations from Shadow Chunk text if present
                    // This is CRITICAL for "Realizado En Local" etc.
                    const chunkRelationsMatch = contentToUse.match(/^\[RELATIONS: (.*?)\]/);
                    let chunkRelations: string[] = [];
                    if (chunkRelationsMatch && chunkRelationsMatch[1]) {
                        chunkRelations = chunkRelationsMatch[1].split(',').map((t: string) => t.trim());
                    }

                    const allEffectiveTags = [
                        ...rawTags,
                        ...extractedHashtags,
                        ...uniqueInlineRefs,
                        ...chunkRelations
                    ];
                    // Deduplicate and join
                    const effectiveTagsString = [...new Set(allEffectiveTags)].join(', ') || '(None)';

                    // Inject relations into LINKED_TO to trick AI into seeing them as connections
                    const effectiveLinks = [
                        ...((c.obj.links || []).map((id: string) => {
                            const linked = objects.find(o => o.id === id);
                            return linked ? `"${linked.title}"` : id;
                        })),
                        ...chunkRelations.map(r => `"${r}"`)
                    ];
                    const linkedTitles = [...new Set(effectiveLinks)].join(', ') || '(No outgoing links)';

                    return `
[OBJECT]
ID: ${c.obj.id}
TYPE: ${c.obj.type.toUpperCase()}
TITLE: ${c.obj.title}
PROPERTIES: ${props}
TAGS: ${effectiveTagsString}
LINKED_TO: ${linkedTitles}
CONTENT:
${cleanContent.slice(0, charLimit)}
[/OBJECT]
`;
                })
            ];

            console.log('[BrainChat] Generated Context:', contextDocs);

            // 6. Call Chat API
            // Map history correctly for the API
            const historyForApi = chatHistory.map(m => ({
                role: m.role,
                parts: [{ text: m.content }] as [{ text: string }]
            }));

            const responseText = await aiService.chat(
                userMsg.content,
                contextDocs,
                historyForApi,
                (attempt, _delayMs, reason) => {
                    setRetryStatus({ isRetrying: true, attempt, reason });
                }
            );
            setRetryStatus(null); // Clear retry status on success

            addChatMessage({
                id: (Date.now() + 1).toString(),
                role: 'model',
                content: responseText,
                timestamp: Date.now()
            });

        } catch (error) {
            console.error(error);
            addChatMessage({
                id: Date.now().toString(),
                role: 'model',
                content: 'Lo siento, tuve un problema procesando tu solicitud. Verifica tu conexión o configuración.',
                timestamp: Date.now()
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (!isEnabled) {
        return (
            <div className="brain-chat-disabled">
                <Sparkles size={48} />
                <h2>Brain Chat no disponible</h2>
                <p>Configura tu API Key de Gemini en los ajustes para hablar con tu cerebro.</p>
            </div>
        );
    }



    return (
        <div className="brain-chat-container">
            <div className="brain-chat-header">
                <Sparkles className="header-icon" />
                <h1>Chat con mi Cerebro</h1>
            </div>

            <div className="brain-chat-messages">
                {chatHistory.map((msg) => (
                    <div key={msg.id} className={`message - wrapper ${msg.role} `}>
                        <div className="message-avatar">
                            {msg.role === 'user' ? <User size={18} /> : <Bot size={18} />}
                        </div>
                        <div className="message-content-group">
                            <div className="message-bubble">
                                {renderContent(msg.content)}
                            </div>
                            {msg.role === 'model' && msg.id !== 'welcome' && (
                                <div className="message-actions">
                                    <button
                                        onClick={() => handleSaveMsgObject(msg.content)}
                                        className="msg-action-btn"
                                        title="Guardar como nota"
                                    >
                                        <Save size={14} /> Guardar Nota
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="message-wrapper model loading">
                        <div className="message-avatar"><Bot size={18} /></div>
                        <div className="message-bubble">
                            {retryStatus ? (
                                <div className="retry-status">
                                    <Loader2 className="animate-spin" size={16} />
                                    <span>
                                        {retryStatus.reason}. Reintentando (intento {retryStatus.attempt}/3)...
                                    </span>
                                </div>
                            ) : (
                                <Loader2 className="animate-spin" size={20} />
                            )}
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="brain-chat-input-area">
                <div className="input-wrapper">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Pregunta algo..."
                        rows={1}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading}
                        className="send-btn"
                    >
                        <Send size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};
