async (data) => {
  //   console.log({ domaindData: data });
  const headers = [
    'Room Number',
    'Room Type',
    'FO Status',
    'Hsk Status',
    'Arrival Day',
    'Departure Day',
    'Guest Name and Last Name',
  ];
  const rows = data.map((obj) =>
    [
      obj.roomN,
      obj.roomT,
      obj.foStatus,
      obj.hkStatus,
      obj.arrDay || '',
      obj.depDay || '',
      obj.guest || '',
    ].join(','),
  );

  return [headers.join(','), ...rows].join('\n');
};
