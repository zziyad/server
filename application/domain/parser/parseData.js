async (input) => {
  const { lines } = await lib.parser;
  const parseAndReplace = (input) =>
    input.replace(/&/g, ',').replace(/\$+/g, ',');

  // Parse input data into structured objects, filtering out invalid ones
  const parseData = (input) =>
    input
      .trim()
      .split('\n')
      .map(parseAndReplace)
      .map(lines)
      .filter(
        (obj) =>
          obj !== null && !(obj.foStatus === 'VAC' && obj.hkStatus === 'IP'),
      );

  return await parseData(input);
};
