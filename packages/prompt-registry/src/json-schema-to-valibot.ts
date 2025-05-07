import * as v from 'valibot';

const convert = (schema: any): v.BaseSchema<any, any, any> => {
  if (!schema || typeof schema !== 'object') return v.any();
  switch (schema.type) {
    case 'string':
      return v.string();
    case 'number':
    case 'integer':
      return v.number();
    case 'boolean':
      return v.boolean();
    case 'array':
      return v.array(convert(schema.items));
    case 'object':
      const props = schema.properties ?? {};
      const req = new Set(schema.required ?? []);
      const shape: Record<string, v.BaseSchema<any, any, any>> = {};
      for (const k in props) {
        const child = convert(props[k]);
        shape[k] = req.has(k) ? child : v.optional(child);
      }
      return v.object(shape);
    default:
      return v.any();
  }
};

export { convert as jsonSchemaToValibot };