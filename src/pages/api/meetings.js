import fs from "fs";
import path from "path";

export default function handler(req, res) {
  const { method } = req;
  const { data } = req.body;

  const filePath = path.join(process.cwd(), "src", "data", "meetings.json");

  if (method === "POST") {
    // Save meetings data
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    res.status(200).json({ message: "Meetings data saved successfully." });
  } else if (method === "GET") {
    // Check if meetings data exists
    if (fs.existsSync(filePath)) {
      const fileData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      res.status(200).json(fileData);
    } else {
      res.status(404).json({ message: "Meetings data not found." });
    }
  } else {
    res.status(405).json({ message: "Method not allowed." });
  }
}
