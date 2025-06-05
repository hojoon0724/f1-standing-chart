import fs from "fs";
import path from "path";

export default function handler(req, res) {
  const { method } = req;
  const { sessionKey } = req.query;
  const { data } = req.body;

  if (method === "GET" && !sessionKey) {
    return res.status(400).json({ message: "Invalid sessionKey." });
  }

  const resolvedSessionKey = method === "GET" ? sessionKey : data?.sessionKey;

  if (!resolvedSessionKey) {
    return res.status(400).json({ message: "Invalid sessionKey." });
  }

  const filePath = path.join(process.cwd(), "src", "data", `session_${resolvedSessionKey}.json`);

  if (method === "POST") {
    // Save session data
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    res.status(200).json({ message: "Session data saved successfully." });
  } else if (method === "GET") {
    // Check if session data exists
    if (fs.existsSync(filePath)) {
      const fileData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      res.status(200).json(fileData);
    } else {
      res.status(404).json({ message: "Session data not found." });
    }
  } else {
    res.status(405).json({ message: "Method not allowed." });
  }
}
