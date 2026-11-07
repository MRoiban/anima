// Shared host logic: the same function is used by the CLI-session proof.
export function matches(query, labels) {
  const needle = query.toLocaleLowerCase('en-US');
  return labels.map((label) =>
    label.toLocaleLowerCase('en-US').includes(needle),
  );
}

// Call after icon.ready with the data/host/host-edit browser modules loaded.
export function attachSearch(icon) {
  const data = icon.data;
  data.bind(data.defaultInstance());
  const query = data.string('$query');
  const labels = Array.from({ length: 5 }, (_, i) => data.string(`$label${i}`));
  const shown = Array.from({ length: 5 }, (_, i) => data.boolean(`$shown${i}`));
  const update = () => {
    const values = matches(query.value, labels.map((label) => label.value));
    data.batch(() => values.forEach((value, i) => shown[i].set(value)));
  };
  const unsubscribe = [query, ...labels].map((value) => value.on('change', update));
  update();
  return () => unsubscribe.forEach((stop) => stop());
}
