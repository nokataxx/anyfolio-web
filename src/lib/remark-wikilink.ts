import type { Root, Text, PhrasingContent } from "mdast"
import type { Plugin } from "unified"
import { visit, SKIP } from "unist-util-visit"

const WIKILINK_RE = /\[\[([^\]]+)\]\]/g

const remarkWikilink: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, "text", (node: Text, index, parent) => {
      if (index === undefined || !parent) return
      if (!WIKILINK_RE.test(node.value)) return

      // Reset regex state
      WIKILINK_RE.lastIndex = 0

      const children: PhrasingContent[] = []
      let lastIndex = 0
      let match: RegExpExecArray | null

      while ((match = WIKILINK_RE.exec(node.value)) !== null) {
        // Text before the match
        if (match.index > lastIndex) {
          children.push({ type: "text", value: node.value.slice(lastIndex, match.index) })
        }

        // WikiLink as a link node with wikilink:// protocol
        const target = match[1]
        children.push({
          type: "link",
          url: `wikilink://${target}`,
          children: [{ type: "text", value: target }],
        })

        lastIndex = match.index + match[0].length
      }

      // Remaining text after last match
      if (lastIndex < node.value.length) {
        children.push({ type: "text", value: node.value.slice(lastIndex) })
      }

      // Replace the text node with the new children
      parent.children.splice(index, 1, ...children)
      return [SKIP, index + children.length]
    })
  }
}

export default remarkWikilink
