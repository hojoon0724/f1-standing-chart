import axios from "axios";
import { Chart, registerables } from "chart.js";
import { useEffect, useState } from "react";
import drivers from "../data/drivers.json";
import pointsSystem from "../data/pointsSystem.json";

Chart.register(...registerables);

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

const addFinalPositionsToDrivers = (drivers, fullSeasonResults, pointsSystem) => {
  return drivers
    .map((driver) => {
      const finalPosition = {};
      const points = {};

      for (const [meetingKey, results] of Object.entries(fullSeasonResults)) {
        const driverResult = results.find((result) => result.driver_number === driver.driver_number);

        if (driverResult) {
          finalPosition[meetingKey] = driverResult.position;
          points[meetingKey] = pointsSystem.points_system_2025.positions[driverResult.position] || 0;
        }
      }

      const totalPoints = Object.values(points).reduce((a, b) => a + b, 0);

      return {
        ...driver,
        final_position: finalPosition,
        points: points,
        total_points: totalPoints,
      };
    })
    .sort((a, b) => b.total_points - a.total_points);
};

const calculateCumulativePoints = (drivers, meetings, pointsSystem) => {
  return drivers
    .map((driver) => {
      let cumulativePoints = 0;
      const cumulativeResults = {};

      meetings.forEach((meeting) => {
        const meetingKey = meeting.meeting_key;
        const points = pointsSystem.points_system_2025.positions[driver.final_position[meetingKey]] || 0;

        cumulativePoints += points;
        cumulativeResults[meetingKey] = cumulativePoints;
      });

      return {
        ...driver,
        cumulative_points: cumulativeResults,
        total_points: cumulativePoints,
      };
    })
    .sort((a, b) => b.total_points - a.total_points);
};

export default function Home() {
  const [meetings, setMeetings] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [fullSeasonResults, setFullSeasonResults] = useState([]);
  const [uniqueDrivers, setUniqueDrivers] = useState([]);

  useEffect(() => {
    if (sessions.length > 0) {
      const sessionKeys = new Set(sessions.map((session) => session.session_key));

      const filteredDrivers = drivers
        .filter((driver) => sessionKeys.has(driver.session_key))
        .filter((driver, index, self) => index === self.findIndex((d) => d.last_name === driver.last_name));

      setUniqueDrivers(filteredDrivers);
    }
  }, [sessions]);

  useEffect(() => {
    const get2025Results = async () => {
      const meetingsData = require("../data/meetings.json");

      const filteredMeetings = meetingsData.filter(
        (meeting) => !meeting.meeting_name.toLowerCase().includes("testing")
      );

      setMeetings(filteredMeetings);

      const qualifyingAndRaceSessions = [];
      const raceResultsByMeeting = {};

      for (const meeting of filteredMeetings) {
        const sessions = await axios.get(`${API_BASE}/sessions?meeting_key=${meeting.meeting_key}`);
        const filteredSessions = sessions.data.filter(
          (session) => session.session_name === "Qualifying" || session.session_name === "Race"
        );

        qualifyingAndRaceSessions.push(...filteredSessions);

        const raceSessions = filteredSessions.filter((session) => session.session_name === "Race");
        const meetingResults = [];

        for (const raceSession of raceSessions) {
          const raceData = await axios.get(`${API_BASE}/position?session_key=${raceSession.session_key}`);

          const finalPositions = {};
          for (const entry of raceData.data) {
            const key = entry.driver_number;
            if (!finalPositions[key] || new Date(entry.date) > new Date(finalPositions[key].date)) {
              finalPositions[key] = entry;
            }
          }

          meetingResults.push(...Object.values(finalPositions));
        }

        raceResultsByMeeting[meeting.meeting_key] = meetingResults;
      }

      setSessions(qualifyingAndRaceSessions);
      setFullSeasonResults(raceResultsByMeeting);
    };

    get2025Results().catch(console.error);
  }, []);

  useEffect(() => {
    if (sessions.length > 0 && fullSeasonResults) {
      const sessionKeys = new Set(sessions.map((session) => session.session_key));

      const filteredDrivers = drivers
        .filter((driver) => sessionKeys.has(driver.session_key))
        .filter((driver, index, self) => index === self.findIndex((d) => d.last_name === driver.last_name));

      const enrichedDrivers = addFinalPositionsToDrivers(filteredDrivers, fullSeasonResults, pointsSystem);
      const driversWithCumulativePoints = calculateCumulativePoints(enrichedDrivers, meetings, pointsSystem);

      setUniqueDrivers(driversWithCumulativePoints);
    }
  }, [sessions, fullSeasonResults, meetings]);

  useEffect(() => {
    let chartInstance;

    const createGraph = () => {
      const ctx = document.getElementById("orderMoveGraph").getContext("2d");

      if (chartInstance) {
        chartInstance.destroy();
      }

      const standingsByMeeting = meetings.map((meeting, meetingIndex) => {
        return uniqueDrivers
          .map((driver) => {
            const cumulativePoints = meetings
              .slice(0, meetingIndex + 1)
              .reduce((sum, m) => sum + (driver.points[m.meeting_key] || 0), 0);

            return {
              driver,
              cumulativePoints,
            };
          })
          .sort((a, b) => b.cumulativePoints - a.cumulativePoints)
          .map((entry, index) => ({
            driver: entry.driver,
            position: index + 1,
          }));
      });

      const datasets = uniqueDrivers.map((driver) => {
        return {
          label: driver.full_name,
          data: meetings.map((meeting, meetingIndex) => {
            const standing = standingsByMeeting[meetingIndex].find(
              (entry) => entry.driver.driver_number === driver.driver_number
            );
            return standing ? standing.position : null;
          }),
          borderColor: `#${driver.team_colour}`,
          borderWidth: 10, // Increased line thickness
          fill: false,
        };
      });

      chartInstance = new Chart(ctx, {
        type: "line",
        data: {
          labels: meetings.map((meeting) => meeting.meeting_code),
          datasets: datasets,
        },
        options: {
          responsive: true,
          scales: {
            y: {
              beginAtZero: false,
              min: 0,
              max: 22,
              reverse: true,
              title: {
                display: true,
                text: "Position",
              },
              ticks: {
                padding: 20, // Increased padding to ensure full visibility of top and bottom lines
              },
            },
            x: {
              title: {
                display: true,
                text: "Meetings",
              },
            },
          },
          plugins: {
            tooltip: {
              callbacks: {
                label: function (context) {
                  const driver = uniqueDrivers.find((d) => d.full_name === context.dataset.label);
                  const meetingIndex = context.dataIndex;
                  const cumulativePoints = meetings
                    .slice(0, meetingIndex + 1)
                    .reduce((sum, m) => sum + (driver.points[m.meeting_key] || 0), 0);

                  return `${context.dataset.label}: ${cumulativePoints} points`;
                },
              },
            },
          },
        },
      });
    };

    createGraph();

    return () => {
      if (chartInstance) {
        chartInstance.destroy();
      }
    };
  }, [uniqueDrivers, meetings]);

  console.log("Meetings:", meetings);
  console.log("Sessions:", sessions);
  console.log("Selected Session:", selectedSession);
  console.log("Full Season Results:", fullSeasonResults);
  console.log("Unique Drivers:", uniqueDrivers);

  return (
    <div className="top-container flex flex-col items-center">
      <div className="total-points-container">
        <h1 className="text-4xl mb-12 text-center">Drivers Championship</h1>
        <div className="championship-table">
          <table className="text-center border-collapse border border-gray-400 w-full">
            <thead className="bg-gray-200">
              <tr>
                <th className="border border-gray-400 p-2">#</th>
                <th className="border border-gray-400 p-2">
                  Driver <br></br>Number
                </th>
                <th className="border border-gray-400 p-2">Driver Name</th>
                <th className="border border-gray-400 p-2">Team Name</th>
                {meetings.map((meeting, index) => (
                  <th key={index} className="border border-gray-400 p-2">
                    {meeting.meeting_code}
                  </th>
                ))}
                <th className="border border-gray-400 p-2">
                  Total<br></br> Points
                </th>
              </tr>
            </thead>
            <tbody>
              {uniqueDrivers.map((driver, index) => (
                <tr key={index} className={index % 2 === 0 ? "bg-gray-100" : "bg-white"}>
                  <td className="border border-gray-400 p-2">{index + 1}</td>
                  <td className="border border-gray-400 p-2" style={{ backgroundColor: `#${driver.team_colour}` }}>
                    {driver.driver_number}
                  </td>
                  <td className="border border-gray-400 p-2">{driver.full_name}</td>
                  <td className="border border-gray-400 p-2">{driver.team_name}</td>
                  {meetings.map((meeting, index) => (
                    <td
                      key={index}
                      className={
                        "border border-gray-400 p-2 leading-3" +
                        (driver.points[meeting.meeting_key] > 0 ? " text-black" : " opacity-30")
                      }
                    >
                      {`${driver.points[meeting.meeting_key] ? driver.points[meeting.meeting_key] : ""}`}
                      <br></br>
                      <span className="text-xs leading-1">{`${driver.final_position[meeting.meeting_key] ? driver.final_position[meeting.meeting_key] : ""}`}</span>
                    </td>
                  ))}
                  <td className="border border-gray-400 p-2">{driver.total_points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="order-move-container">
        <canvas id="orderMoveGraph" width="1000" height="800"></canvas>
      </div>
    </div>
  );
}
