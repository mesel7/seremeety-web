import "./MenuItem.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

const MenuItem = ({ icon, color, selectedIcon, selectedColor, dataRoute, isSelected, onClick }) => {
    return (
        <div className="MenuItem" data-route={dataRoute} onClick={onClick}>
            <FontAwesomeIcon
                icon={isSelected ? selectedIcon : icon}
                size={"2x"}
                style={{ color: isSelected ? selectedColor : color }}
            />
        </div>
    ); 
};

export default MenuItem;