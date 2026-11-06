# Component guard literal — pending

The existing condition parser already delegates scalar comparisons to bind. Its function registry accepts numeric arguments and return types only. `component("row")` needs the typed literal extension being implemented by the data-extras owner; no core condition-parser change is needed here. The format decision is retained, and pending probes remain marked.
