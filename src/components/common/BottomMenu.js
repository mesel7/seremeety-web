import { useLocation, useNavigate } from "react-router-dom";
import "./BottomMenu.css";
import { useEffect, useState } from "react";
import { menuItem } from "../../utils";
import MenuItem from "./MenuItem";

const BottomMenu = () => {
    const [selectedRoute, setSelectedRoute] = useState("");
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        setSelectedRoute(location.pathname);
    }, [location.pathname]);

    const isSelected = (route) => {
        if (!route) {
            return false;
        }
        if (route === "/") {
            return selectedRoute === route;
        }
        return selectedRoute.startsWith(route) && selectedRoute !== "/";
    };
    
    const handleMenuClick = (e) => {
        const route = e.currentTarget.getAttribute("data-route");
        if (route) {
            navigate(route);
            setSelectedRoute(route);
        }
    };

    return (
        <div className="BottomMenu">
            {menuItem.map((it, idx) => (
                <MenuItem
                    key={idx}
                    {...it}
                    isSelected={isSelected(it.dataRoute)}
                    onClick={handleMenuClick}
                />
            ))}
        </div>
    );
};

export default BottomMenu;