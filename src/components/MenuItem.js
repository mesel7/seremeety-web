import "./MenuItem.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

const MenuItem = ({ icon, color, selectedColor, dataRoute, isSelected, onClick }) => {
    return (
        <div className="MenuItem" data-route={dataRoute} onClick={onClick}>
            <FontAwesomeIcon
                icon={icon}
                size={"2x"}
                style={{ color: isSelected ? selectedColor : color }}
            />
        </div>
    ); 
};

export default MenuItem;