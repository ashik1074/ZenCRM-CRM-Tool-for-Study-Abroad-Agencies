"use client";
import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading2, Italic, Link2, List, ListOrdered, Quote, Strikethrough, Undo2, Redo2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function RichTextEditor({ value, onChange, placeholder, id, minimal }: { value: string; onChange: (html: string) => void; placeholder?: string; id?: string; minimal?: boolean }) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit.configure({ link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" } } })],
    content: value || "",
    editorProps: {
      attributes: {
        class: "prose-crm px-3 py-2 text-sm focus:outline-none",
        "aria-label": placeholder ?? "Rich text editor",
        ...(id ? { id } : {}),
        role: "textbox",
        "aria-multiline": "true",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? "" : editor.getHTML()),
  });

  // keep in sync when the form resets
  useEffect(() => {
    if (editor && value !== editor.getHTML() && !(value === "" && editor.isEmpty)) editor.commands.setContent(value || "", { emitUpdate: false });
  }, [value, editor]);

  if (!editor) return <div className="h-32 rounded-md border bg-muted/30" />;

  const btn = (active: boolean, label: string, onClick: () => void, Icon: typeof Bold) => (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onClick}
      className={cn("rounded p-1.5 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active && "bg-accent text-accent-foreground")}
    >
      <Icon className="h-4 w-4" />
    </button>
  );

  return (
    <div className="rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
      <div className="flex flex-wrap gap-0.5 border-b p-1" role="toolbar" aria-label="Formatting">
        {btn(editor.isActive("bold"), "Bold", () => editor.chain().focus().toggleBold().run(), Bold)}
        {btn(editor.isActive("italic"), "Italic", () => editor.chain().focus().toggleItalic().run(), Italic)}
        {btn(editor.isActive("strike"), "Strikethrough", () => editor.chain().focus().toggleStrike().run(), Strikethrough)}
        {!minimal && btn(editor.isActive("heading", { level: 2 }), "Heading", () => editor.chain().focus().toggleHeading({ level: 2 }).run(), Heading2)}
        {btn(editor.isActive("bulletList"), "Bullet list", () => editor.chain().focus().toggleBulletList().run(), List)}
        {btn(editor.isActive("orderedList"), "Numbered list", () => editor.chain().focus().toggleOrderedList().run(), ListOrdered)}
        {!minimal && btn(editor.isActive("blockquote"), "Quote", () => editor.chain().focus().toggleBlockquote().run(), Quote)}
        {btn(editor.isActive("link"), "Link", () => {
          const prev = editor.getAttributes("link").href as string | undefined;
          const url = window.prompt("Link URL", prev ?? "https://");
          if (url === null) return;
          if (url === "") editor.chain().focus().unsetLink().run();
          else editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
        }, Link2)}
        <span className="mx-1 w-px bg-border" />
        {btn(false, "Undo", () => editor.chain().focus().undo().run(), Undo2)}
        {btn(false, "Redo", () => editor.chain().focus().redo().run(), Redo2)}
      </div>
      <EditorContent editor={editor} className="max-h-[50vh] overflow-y-auto" />
    </div>
  );
}

/** Render stored (sanitized) HTML. */
export function RichText({ html, className }: { html: string | null | undefined; className?: string }) {
  if (!html) return <p className="text-sm text-muted-foreground">No description.</p>;
  return <div className={cn("prose-crm text-sm", className)} dangerouslySetInnerHTML={{ __html: html }} />;
}
