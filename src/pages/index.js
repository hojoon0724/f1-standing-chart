import axios from "axios";
import { useCallback, useEffect, useState } from "react";

export default function Home() {
  const [year, setYear] = useState("2025");
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`https://api.openf1.org/v1/meetings?year=${year}`);
      console.log("API Response:", response.data);
      setSchedule(response.data);
    } catch (error) {
      console.error("Error fetching schedule:", error);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <h1 className="text-2xl font-bold mb-4">F1 Standings</h1>

      <div className="mb-4">
        <label htmlFor="year" className="mr-2">
          Select Year:
        </label>
        <select id="year" value={year} onChange={(e) => setYear(e.target.value)} className="border rounded px-2 py-1">
          {[...Array(10)].map((_, i) => {
            const y = 2025 - i;
            return (
              <option key={y} value={y}>
                {y}
              </option>
            );
          })}
        </select>
      </div>

      {loading ? (
        <p>Loading schedule...</p>
      ) : (
        <div>
          {schedule.map((race) => (
            <div key={race.id} className="mb-4">
              <h2 className="text-xl font-semibold">{race.name}</h2>
              <table className="table-auto border-collapse border border-gray-400 w-full">
                <thead>
                  <tr>
                    <th className="border border-gray-400 px-2 py-1">Driver</th>
                    <th className="border border-gray-400 px-2 py-1">Qualified Position</th>
                    <th className="border border-gray-400 px-2 py-1">Race Position</th>
                  </tr>
                </thead>
                <tbody>
                  {race.results && Array.isArray(race.results) ? (
                    race.results.map((result) => (
                      <tr key={result.driverId}>
                        <td className="border border-gray-400 px-2 py-1">{result.driverName}</td>
                        <td className="border border-gray-400 px-2 py-1">{result.qualifiedPosition}</td>
                        <td className="border border-gray-400 px-2 py-1">{result.racePosition}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="border border-gray-400 px-2 py-1" colSpan="3">
                        No results available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
