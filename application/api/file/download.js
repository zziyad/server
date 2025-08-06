({
  access: 'public',
  method: async ({ fileName }) => {
    try {
      const resourcesPath = node.path.join(application.path, './resources');
      const filePath = node.path.join(resourcesPath, 'report.csv');
      const csvStream = node.fs.createWriteStream(filePath); 
      const fileRead = `/home/zi/Documents/programming/divAcademy/server/${fileName}`;
      const data = await node.fsp.readFile(fileRead, 'utf8');

      const lineToObject = (line) => {
        if (!line.startsWith(',')) return null;
        const parts = line.split(',');
        const roomN = parts[1].length === 1 ? parts[2] : parts[1];
        if (!roomN || roomN.length !== 3) return null;
        let index = roomN === parts[1] ? 2 : 3;
        const roomT = parts[index++];
        if (!roomT) return null;
        const [foStatus, hkStatus] = extractStatuses(parts, index);
        if (!foStatus || !hkStatus) return null;
        index += foStatus && hkStatus ? 2 : 0;
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
        const [arrDay, depDay] = extractArrivalDepartureDays(parts, index);
        if (!arrDay || !depDay) return null;
        index += arrDay && depDay ? 2 : 0;
        const guest = extractGuestName(parts, index);
        return { roomN, roomT, foStatus, hkStatus, arrDay, depDay, guest };
      };

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
        let guestFirstName = parts[startIndex];
        while (guestFirstName && /^\d/.test(guestFirstName)) {
          startIndex++; // Increment the index
          guestFirstName = parts[startIndex]; // Update the guestFirstName
        }
        const guestLastName = parts[startIndex + 1];
        return guestFirstName && guestLastName
          ? `${guestFirstName} ${guestLastName}`.trim()
          : '';
      };

      const parseData = (input) =>
        input
          .trim()
          .split('\n')
          .map((input) => input.replace(/&/g, ',').replace(/\$+/g, ','))
          .map(lineToObject)
          .filter(
            (obj) =>
              obj !== null &&
              !(obj.foStatus === 'VAC' && obj.hkStatus === 'IP'),
          );

      const convertToCSV = (data) => {
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

      const parsedData = parseData(data);
      const csvData = convertToCSV(parsedData);
      csvStream.write(csvData);
      csvStream.end();
      context.client.exp(filePath);
      return { status: 'fulfilled' };
    } catch (error) {
      console.error('Error finding file:', error);
      return {
        status: 'reject',
        error: error.message,
      };
    }
  },
});
