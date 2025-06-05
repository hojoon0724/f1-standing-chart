import axios from "axios";
import { useEffect, useState } from "react";
import drivers from "../data/drivers.json";

// API Base URL
const API_BASE = "https://api.openf1.org/v1";

// Utility Functions
const fetchAndSaveData = async (url, apiEndpoint, dataKey) => {
  const response = await axios.get(url);
  const data = response.data;

  await fetch(apiEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data }),
  });

  return data;
};

const enrichDriverData = async (position, meetingKey) => {
  let driverData = drivers.find(
    (driver) => driver.driver_number === position.driver_number && driver.meeting_key === meetingKey
  );

  if (!driverData) {
    driverData = await updateDriversData(position.driver_number, meetingKey);
  }

  return {
    ...position,
    driver_name: driverData?.full_name || "Unknown",
    team_name: driverData?.team_name || "Unknown",
    team_colour: `#${driverData?.team_colour}` || "000000",
  };
};

const updateDriversData = async (missingDriverNumber, meetingKey) => {
  try {
    const driverRes = await axios.get(
      `${API_BASE}/driver?driver_number=${missingDriverNumber}&meeting_key=${meetingKey}`
    );
    const newDriverData = driverRes.data;

    if (newDriverData) {
      const updatedDrivers = [...drivers, newDriverData];

      await fetch(`/api/sessionData`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type: "drivers", data: updatedDrivers }),
      });

      console.log("Driver data updated successfully.");
      return newDriverData;
    }
  } catch (error) {
    console.error("Error fetching or updating driver data:", error);
  }

  return { full_name: "Unknown", team_name: "Unknown", team_colour: "000000" };
};
export default function Home() {
  const [meetings, setMeetings] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  // Get unique drivers by full_name, keeping only the latest (by meeting_key)
  const [uniqueDrivers, setUniqueDrivers] = useState([]);

  useEffect(() => {
    if (sessions.length > 0) {
      const sessionKeys = new Set(sessions.map((session) => session.session_key));

      const filteredDrivers = drivers
        .filter((driver) => sessionKeys.has(driver.session_key))
        .filter(
          (driver, index, self) =>
        index === self.findIndex((d) => d.last_name === driver.last_name)
        );

      setUniqueDrivers(filteredDrivers);
    }
  }, [sessions]);

  useEffect(() => {
    const get2025Results = async () => {
      const meetings = await fetchAndSaveData(`${API_BASE}/meetings?year=2025`, `/api/meetings`, "meetings");

      setMeetings(meetings);

      const qualifyingAndRaceSessions = [];

      for (const meeting of meetings) {
        const sessions = await axios.get(`${API_BASE}/sessions?meeting_key=${meeting.meeting_key}`);
        qualifyingAndRaceSessions.push(
          ...sessions.data.filter((session) => session.session_name === "Qualifying" || session.session_name === "Race")
        );
      }

      setSessions(qualifyingAndRaceSessions);
    };

    get2025Results().catch(console.error);
  }, []);

  const handleSessionSelect = async (sessionKey) => {
    try {
      const response = await fetch(`/api/sessionData?sessionKey=${sessionKey}`);

      let positions;
      if (response.status === 200) {
        positions = await response.json();
      } else {
        const posRes = await axios.get(`${API_BASE}/position?session_key=${sessionKey}`);
        positions = posRes.data;

        await fetch(`/api/sessionData`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sessionKey, data: positions }),
        });
      }

      const finalPositions = {};
      for (const entry of positions) {
        const key = entry.driver_number;
        if (!finalPositions[key] || new Date(entry.date) > new Date(finalPositions[key].date)) {
          finalPositions[key] = entry;
        }
      }

      const enrichedPositions = await Promise.all(
        Object.values(finalPositions).map((position) => enrichDriverData(position, position.meeting_key))
      );

      setSelectedSession({
        sessionKey,
        positions: enrichedPositions.sort((a, b) => a.position - b.position),
      });
    } catch (error) {
      console.error("Error handling session select:", error);
    }
  };

  console.log("Meetings:", meetings);
  console.log("Sessions:", sessions);
  console.log("Selected Session:", selectedSession);
  console.log("Unique Drivers:", uniqueDrivers);

  return (
    <div className="top-container">
      <h1>Drivers Championship</h1>
      <div className="championship-table">
        <table>
          <thead>
            <tr>
              <th>Position</th>
              <th>Driver Number</th>
              <th>Driver Name</th>
              <th>Team Name</th>
              {meetings.map((meeting, index) => (
                <th key={index}>{meeting.meeting_code}</th>
              ))}
              <th>Total Points</th>
            </tr>
          </thead>
          <tbody>
            {uniqueDrivers.map((driver, index) => (
              <tr key={index}>
                <td>{driver.position}</td>
                <td>{driver.driver_number}</td>
                <td>{driver.full_name}</td>
                <td>{driver.team_name}</td>
                {meetings.map((meeting, index) => (
                  <td key={index}>{index}</td>

                  // <td key={index}>{driver.meeting_results[meeting.meeting_key] || 0}</td>
                ))}
                <td>{driver.total_points || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="meetings-list">
        <table>
          <thead>
            <tr>
              <th>Meeting Name</th>
              <th>Meeting Key</th>
              <th>Start Date</th>
            </tr>
          </thead>
          <tbody>
            {meetings.map((meeting, index) => (
              <tr key={index}>
                <td>{meeting.meeting_name}</td>
                <td>{meeting.meeting_key}</td>
                <td>{new Date(meeting.date_start).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="sessions-list">
        <h2>Sessions</h2>
        <table>
          <thead>
            <tr>
              <th>Session Name</th>
              <th>Session Key</th>
              <th>Meeting Key</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session, index) => (
              <tr key={index}>
                <td>{session.session_name}</td>
                <td>{session.session_key}</td>
                <td>{session.meeting_key}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="sessions-dropdown">
        <h2>Select a Session</h2>
        <select onChange={(e) => handleSessionSelect(e.target.value)}>
          <option value="">-- Select a Session --</option>
          {sessions.map((session, index) => (
            <option key={index} value={session.session_key}>
              {session.session_name} ({session.session_key})
            </option>
          ))}
        </select>
      </div>

      {selectedSession && (
        <div className="session-results">
          <h2>Results for Session {selectedSession.sessionKey}</h2>
          <table>
            <thead>
              <tr>
                <th>Position</th>
                <th>Driver Number</th>
                <th>Broadcast Name</th>
              </tr>
            </thead>
            <tbody>
              {selectedSession.positions.map((position, index) => (
                <tr key={index}>
                  <td>{position.position}</td>
                  <td>{position.driver_number}</td>
                  <td>{position.driver_name}</td>
                  <td style={{ color: position.team_colour }}>{position.team_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
