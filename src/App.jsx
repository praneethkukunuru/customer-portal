import { Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import SecureMessaging from "./pages/SecureMessaging";

const App = () => {
    return (
        <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/secure-messaging" element={<SecureMessaging />} />
        </Routes>
    );
};

export default App;

