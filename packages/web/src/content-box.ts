/** CSS content dimensions, independent of box-sizing (and without transform/rounding). */
export function contentBox(element: Element) {
  const css = getComputedStyle(element);
  const size = (axis: 'width' | 'height', sides: string[]) =>
    parseFloat(css[axis]) -
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
