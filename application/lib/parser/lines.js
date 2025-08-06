async (line) => {
  const extractStatuses = (parts, startIndex) => {
    let foStatus = '';
    let hkStatus = '';

    for (let i = startIndex; i < parts.length; i++) {
      const part = parts[i];
      if (!foStatus && part.length === 3 && part === part.toUpperCase()) {
        foStatus = part;
      } else if (
        !hkStatus &&
        part.length === 2 &&
        part === part.toUpperCase()
      ) {
        hkStatus = part;
      }
      if (foStatus && hkStatus) break; // Stop loop early when both are found
    }

    return [foStatus, hkStatus];
  };

  const extractArrivalDepartureDays = (parts, startIndex) => {
    let arrDay = '';
    let depDay = '';

    for (let i = startIndex; i < parts.length; i++) {
      if (parts[i].includes('-')) {
        if (!arrDay) {
          arrDay = parts[i];
        } else {
          depDay = parts[i];
          break;
        }
      }
    }

    return [arrDay, depDay];
  };

  const extractGuestName = (parts, startIndex) => {
    console.log({ parts, startIndex });

    let guestFirstName = parts[startIndex];

    // Check if the first name starts with a number
    while (guestFirstName && /^\d/.test(guestFirstName)) {
      startIndex++; // Increment the index
      guestFirstName = parts[startIndex]; // Update the guestFirstName
    }

    const guestLastName = parts[startIndex + 1];

    return guestFirstName && guestLastName ?
      `${guestFirstName} ${guestLastName}`.trim() :
      '';
  };

  const lineToObject = (line) => {
    if (!line.startsWith(',')) return null;

    const parts = line.split(',');

    // Extract room number
    const roomN = parts[1].length === 1 ? parts[2] : parts[1];
    if (!roomN || roomN.length !== 3) return null;

    let index = roomN === parts[1] ? 2 : 3;

    // Extract room type
    const roomT = parts[index++];
    if (!roomT) return null; // Early exit for invalid room type

    // Extract foStatus and hkStatus
    const [foStatus, hkStatus] = extractStatuses(parts, index);
    if (!foStatus || !hkStatus) return null;

    index += foStatus && hkStatus ? 2 : 0; // Move index past the statuses

    // If foStatus is 'VAC', return early with empty fields
    if (foStatus === 'VAC') {
      return {
        roomN,
        roomT,
        foStatus,
        hkStatus,
        arrDay: '',
        depDay: '',
        guest: '',
      };
    }

    // Extract arrival and departure days
    const [arrDay, depDay] = extractArrivalDepartureDays(parts, index);
    if (!arrDay || !depDay) return null; // Early exit for invalid dates

    index += arrDay && depDay ? 2 : 0; // Move index past the dates

    // Extract guest name
    const guest = extractGuestName(parts, index);

    return { roomN, roomT, foStatus, hkStatus, arrDay, depDay, guest };
  };

  return lineToObject(line);
};
