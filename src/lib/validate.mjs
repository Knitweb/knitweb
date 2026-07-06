// validate.mjs — compacte JSON-Schema-subset validator voor field-configs (§A3).
// Geen externe schema-lib (GRENZEN KW-002): ondersteunt exact wat field.schema.json
// gebruikt — type (object/string/integer/array), required, additionalProperties:false,
// properties, pattern, enum, maxLength, minimum, maxItems, items, geneste objecten.
// Retourneert een array van leesbare fouten met pad + veld.

function typeOf(v) {
  if (Array.isArray(v)) return "array";
  if (v === null) return "null";
  if (Number.isInteger(v)) return "integer";
  return typeof v; // "string" | "number" | "boolean" | "object"
}

function join(path, key) {
  return path ? `${path}.${key}` : key;
}

/** Valideer `value` tegen (sub)`schema`; push fouten (`{path,msg}`) in `errors`. */
export function validateAgainst(value, schema, path, errors) {
  // enum
  if (schema.enum) {
    if (!schema.enum.includes(value)) {
      errors.push({ path, msg: `moet één van [${schema.enum.join(", ")}] zijn, kreeg ${JSON.stringify(value)}` });
    }
    return errors;
  }

  const t = schema.type;
  if (t) {
    const actual = typeOf(value);
    // JSON-Schema: een integer is ook een number; hier vragen we exact integer waar gevraagd.
    const ok = t === actual || (t === "number" && actual === "integer");
    if (!ok) {
      errors.push({ path, msg: `type moet "${t}" zijn, kreeg "${actual}"` });
      return errors; // verdere checks zijn zinloos bij verkeerd type
    }
  }

  if (t === "string" && typeof value === "string") {
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      errors.push({ path, msg: `voldoet niet aan patroon ${schema.pattern}` });
    }
    if (schema.maxLength != null && value.length > schema.maxLength) {
      errors.push({ path, msg: `te lang (${value.length} > maxLength ${schema.maxLength})` });
    }
  }

  if (t === "integer" && Number.isInteger(value)) {
    if (schema.minimum != null && value < schema.minimum) {
      errors.push({ path, msg: `moet ≥ ${schema.minimum} zijn, kreeg ${value}` });
    }
  }

  if (t === "array" && Array.isArray(value)) {
    if (schema.maxItems != null && value.length > schema.maxItems) {
      errors.push({ path, msg: `te veel items (${value.length} > maxItems ${schema.maxItems})` });
    }
    if (schema.items) {
      value.forEach((item, i) => validateAgainst(item, schema.items, `${path}[${i}]`, errors));
    }
  }

  if (t === "object" && typeOf(value) === "object") {
    for (const req of schema.required || []) {
      if (!(req in value)) errors.push({ path: join(path, req), msg: "verplicht veld ontbreekt" });
    }
    const props = schema.properties || {};
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in props)) errors.push({ path: join(path, key), msg: "onbekend veld (additionalProperties: false)" });
      }
    }
    for (const [key, sub] of Object.entries(props)) {
      if (key in value) validateAgainst(value[key], sub, join(path, key), errors);
    }
  }

  return errors;
}

/** Valideer een field-config tegen het schema. Retourneert een lijst foutregels. */
export function validateField(cfg, schema) {
  const errors = validateAgainst(cfg, schema, "", []);
  return errors.map((e) => `${e.path || "(root)"}: ${e.msg}`);
}
