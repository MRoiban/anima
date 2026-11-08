# Alternate native authoring paths (P7-8)

The run-list retry binds the list directly at Text instead of referencing DataBindPath and authors
WXYZ into the item before load. The runtime dump contains WXYZ, but both frames draw the seven
literal CONTROL glyphs (376 nonwhite pixels). The text-style retry preassigns the alternate style
on the instance instead of issuing a rejected runtime setter. The dump still exposes an empty
artboard property, and both frames retain the normal small black text (166 nonwhite pixels).
These observations complement the original P6/P7 controls; they are not native parity passes.
Row-specific skip.json files point here and to Anima's independent mutation tests.
