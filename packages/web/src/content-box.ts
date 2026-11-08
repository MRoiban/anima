/** CSS content dimensions, independent of box-sizing (and without transform/rounding). */
export function contentBox(element: Element) {
  const css = getComputedStyle(element);
  // A hidden/inline host keeps unresolved `50%`/`auto` values: unmeasurable (NaN), not pixels.
  const size = (axis: 'width' | 'height', sides: string[]) =>
    (css[axis].endsWith('px') ? parseFloat(css[axis]) : NaN) -
    (css.boxSizing === 'border-box'
      ? sides.reduce(
          (n, side) =>
            n +
            parseFloat(css.getPropertyValue('border-' + side + '-width')) +
            parseFloat(css.getPropertyValue('padding-' + side)),
          0,
        )
      : 0);
  return {
    width: size('width', ['left', 'right']),
    height: size('height', ['top', 'bottom']),
    left: parseFloat(css.paddingLeft),
    top: parseFloat(css.paddingTop),
  };
}
