// TaskShortcutExtension - Detects "TD " pattern at line start and creates task on Enter
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface TaskShortcutExtensionOptions {
    // Callback to create a task object
    onCreateTask: (title: string) => Promise<{ id: string; title: string; status: string } | null>;
}

export const TaskShortcutExtension = Extension.create<TaskShortcutExtensionOptions>({
    name: 'taskShortcutExtension',

    addOptions() {
        return {
            onCreateTask: async () => null,
        };
    },

    addKeyboardShortcuts() {
        return {
            Enter: ({ editor }) => {
                const { state } = editor;
                const { selection } = state;
                const { $from } = selection;

                // Get the current line text
                const lineStart = $from.start();
                const lineText = $from.parent.textContent;

                // Check if line starts with "TD " (case sensitive)
                if (!lineText.startsWith('TD ')) {
                    return false;
                }

                // Extract task title (everything after "TD ")
                const taskTitle = lineText.slice(3).trim();

                if (!taskTitle) {
                    return false;
                }

                const { onCreateTask } = this.options;

                // Process asynchronously
                (async () => {
                    const taskData = await onCreateTask(taskTitle);
                    if (!taskData) return;

                    const { tr } = editor.state;
                    const lineEnd = lineStart + lineText.length;

                    // Delete the "TD title" text
                    tr.delete(lineStart, lineEnd);

                    // Insert the task inline node
                    const taskNode = editor.state.schema.nodes.taskInline.create({
                        id: taskData.id,
                        title: taskData.title,
                        status: taskData.status || 'Pendiente',
                    });

                    tr.insert(lineStart, taskNode);

                    // Move cursor to next line
                    editor.view.dispatch(tr);

                    // Add a new paragraph after the task
                    editor.commands.enter();
                })();

                // Prevent default Enter behavior while we process
                return true;
            },
        };
    },

    addProseMirrorPlugins() {
        return [
            new Plugin({
                key: new PluginKey('taskShortcutExtension'),
                // Visual decoration for "TD " pattern
                state: {
                    init() {
                        return DecorationSet.empty;
                    },
                    apply(tr, _oldSet) {
                        const decorations: Decoration[] = [];

                        tr.doc.descendants((node, pos) => {
                            if (!node.isText || !node.text) return;

                            // Check if this text node starts a paragraph with "TD "
                            const text = node.text;
                            if (text.startsWith('TD ') || text.match(/^TD\s/)) {
                                // Highlight "TD" part
                                decorations.push(
                                    Decoration.inline(pos, pos + 2, {
                                        class: 'task-shortcut-hint',
                                    })
                                );
                            }
                        });

                        return DecorationSet.create(tr.doc, decorations);
                    },
                },
            }),
        ];
    },
});
