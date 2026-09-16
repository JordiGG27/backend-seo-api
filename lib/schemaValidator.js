function collectTypesFromJsonLd(node, types) {
  if (Array.isArray(node)) {
    node.forEach((item) => collectTypesFromJsonLd(item, types));
    return;
  }
  if (!node || typeof node !== 'object') return;

  if (node['@graph']) {
    collectTypesFromJsonLd(node['@graph'], types);
  }

  const type = node['@type'];
  if (Array.isArray(type)) {
    type.forEach((t) => types.add(t));
  } else if (typeof type === 'string') {
    types.add(type);
  }

  Object.values(node).forEach((value) => {
    if (value && typeof value === 'object') {
      collectTypesFromJsonLd(value, types);
    }
  });
}

export function extractStructuredData($) {
  const types = new Set();
  let validJsonLdBlocks = 0;
  let invalidJsonLdBlocks = 0;

  const jsonLdScripts = $('script[type="application/ld+json"]');
  jsonLdScripts.each((_, el) => {
    const raw = $(el).contents().text();
    try {
      const json = JSON.parse(raw);
      collectTypesFromJsonLd(json, types);
      validJsonLdBlocks += 1;
    } catch {
      invalidJsonLdBlocks += 1;
    }
  });

  const microdataElements = $('[itemscope][itemtype]');
  microdataElements.each((_, el) => {
    const itemtype = $(el).attr('itemtype');
    const typeName = itemtype?.split('/').filter(Boolean).pop();
    if (typeName) types.add(typeName);
  });

  return {
    hasStructuredData: types.size > 0,
    types: [...types],
    jsonLd: {
      blocksFound: jsonLdScripts.length,
      validBlocks: validJsonLdBlocks,
      invalidBlocks: invalidJsonLdBlocks,
    },
    microdata: {
      elementsFound: microdataElements.length,
    },
  };
}
