import { registerHooks } from 'node:module';
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      return nextResolve(specifier, { ...context, parentURL: import.meta.url });
    }
  },
});
