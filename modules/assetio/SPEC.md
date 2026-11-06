# Asset host IO

Internal split of the assets browser entry: source resolution, policy and image preloading.
`@anima-format/web/assets` imports this entry automatically; no additional `requires` token
or document fields. Core remains pure and DOM-free. The independent byte budget measures
this IO separately; assets is measured over assetio. This follows the optional host consumer
boundary in [web research](../../docs/research/rive-web-runtime.md) §1.
