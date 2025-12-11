// TaskInlineNode - TipTap Node for rendering inline tasks with TAREA badge
import { Node, mergeAttributes } from '@tiptap/core';

export interface TaskInlineNodeOptions {
    HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        taskInlineNode: {
            insertTaskInline: (attrs: { id: string; title: string; status?: string }) => ReturnType;
        };
    }
}

export const TaskInlineNode = Node.create<TaskInlineNodeOptions>({
    name: 'taskInline',

    group: 'inline',
    inline: true,
    selectable: true,
    atom: true,

    addOptions() {
        return {
            HTMLAttributes: {},
        };
    },

    addAttributes() {
        return {
            id: {
                default: null,
                parseHTML: element => element.getAttribute('data-task-id'),
                renderHTML: attributes => ({
                    'data-task-id': attributes.id,
                }),
            },
            title: {
                default: '',
                parseHTML: element => element.getAttribute('data-task-title'),
                renderHTML: attributes => ({
                    'data-task-title': attributes.title,
                }),
            },
            status: {
                default: 'Pendiente',
                parseHTML: element => element.getAttribute('data-status') || 'Pendiente',
                renderHTML: attributes => ({
                    'data-status': attributes.status,
                }),
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'span[data-type="task-inline"]',
            },
        ];
    },

    renderHTML({ node, HTMLAttributes }) {
        const statusClass = node.attrs.status === 'Completada' ? 'task-completed' : '';

        return [
            'span',
            mergeAttributes(
                {
                    'data-type': 'task-inline',
                    class: `task-inline ${statusClass}`.trim(),
                },
                this.options.HTMLAttributes,
                HTMLAttributes
            ),
            [
                'span',
                { class: 'task-badge' },
                'TAREA',
            ],
            [
                'span',
                { class: 'task-title' },
                node.attrs.title,
            ],
        ];
    },

    addCommands() {
        return {
            insertTaskInline:
                (attrs) =>
                    ({ commands }) => {
                        return commands.insertContent({
                            type: this.name,
                            attrs,
                        });
                    },
        };
    },
});
