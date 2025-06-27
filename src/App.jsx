import { useEffect, useState } from "react";
import Overview from "./Overview.jsx";

const App = () => {
    const [data, setData] = useState(null);
  useEffect(() => {
    fetch("./MC1_graph_artworks.json")
        .then((response) => response.json())
        .then((json) => setData(json))
        .catch((error) => console.error("Error loading data:", error));
  }, []);

  return (
    <div>
      <h1>VAST 2025 MC1</h1>
        <div className="vis-container">
            {data ? <Overview data={data}/> : <div>Loading...</div>}
        </div>
    </div>
  );
}
export default App;