import { useLocation, useNavigate } from "react-router-dom";
import "./BottomMenu.css";
import { forwardRef, useCallback, useEffect, useState } from "react";
import { menuItem } from "../../utils";
import MenuItem from "./MenuItem";

const BottomMenu = forwardRef((props, ref) => {
    const [selectedRoute, setSelectedRoute] = useState("");
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        setSelectedRoute(location.pathname);
    }, [location.pathname]);

    const isSelected = useCallback((route) => {
        if (!route) {
            return false;
        }
        if (route === "/") {
            return selectedRoute === route;
        }
        return selectedRoute.startsWith(route) && selectedRoute !== "/";
    }, [selectedRoute]);
    
    const handleMenuClick = useCallback((e) => {
        const route = e.currentTarget.getAttribute("data-route");
        if (route) {
            navigate(route);
            setSelectedRoute((prev) => route);
        }
    }, [navigate]);

    return (
        <div className="BottomMenu" ref={ref}>
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
});

export default BottomMenu;