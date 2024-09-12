import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import "./SettingItem.css";
import { icons } from "../../utils";

const SettingItem = ({ content, onClick }) => {
    return (
        <div className="SettingItem" onClick={onClick}>
            {content}
            <FontAwesomeIcon icon={icons.faAngleRight} />
        </div>
    );
};

export default SettingItem;