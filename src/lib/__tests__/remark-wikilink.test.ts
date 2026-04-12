import { describe, it, expect } from "vitest"
import { unified } from "unified"
import remarkParse from "remark-parse"
import remarkWikilink from "../remark-wikilink"
import type { Root, Link, Text } from "mdast"

function parseWithWikilink(markdown: string): Root {
  const processor = unified().use(remarkParse).use(remarkWikilink)
  return processor.parse(markdown) as Root
  // runSync applies the plugin transforms
}

function processWithWikilink(markdown: string): Root {
  const processor = unified().use(remarkParse).use(remarkWikilink)
  const tree = processor.parse(markdown)
  return processor.runSync(tree) as Root
}

describe("remarkWikilink", () => {
  it("converts [[link]] to a wikilink:// link node", () => {
    const tree = processWithWikilink("Hello [[MyNote]] world")
    const paragraph = tree.children[0]
    expect(paragraph.type).toBe("paragraph")

    if (paragraph.type === "paragraph") {
      const link = paragraph.children.find(
        (c): c is Link => c.type === "link",
      )
      expect(link).toBeDefined()
      expect(link!.url).toBe("wikilink://MyNote")
      expect((link!.children[0] as Text).value).toBe("MyNote")
    }
  })

  it("preserves text before and after the wikilink", () => {
    const tree = processWithWikilink("before [[note]] after")
    const paragraph = tree.children[0]
    if (paragraph.type === "paragraph") {
      const texts = paragraph.children.filter(
        (c): c is Text => c.type === "text",
      )
      expect(texts.map((t) => t.value)).toEqual(["before ", " after"])
    }
  })

  it("handles multiple wikilinks in one line", () => {
    const tree = processWithWikilink("See [[A]] and [[B]]")
    const paragraph = tree.children[0]
    if (paragraph.type === "paragraph") {
      const links = paragraph.children.filter(
        (c): c is Link => c.type === "link",
      )
      expect(links).toHaveLength(2)
      expect(links[0].url).toBe("wikilink://A")
      expect(links[1].url).toBe("wikilink://B")
    }
  })

  it("leaves text without wikilinks unchanged", () => {
    const tree = processWithWikilink("No links here")
    const paragraph = tree.children[0]
    if (paragraph.type === "paragraph") {
      expect(paragraph.children).toHaveLength(1)
      expect(paragraph.children[0].type).toBe("text")
    }
  })

  it("handles wikilink with spaces in the name", () => {
    const tree = processWithWikilink("See [[My Long Note Name]]")
    const paragraph = tree.children[0]
    if (paragraph.type === "paragraph") {
      const link = paragraph.children.find(
        (c): c is Link => c.type === "link",
      )
      expect(link!.url).toBe("wikilink://My Long Note Name")
    }
  })
})
