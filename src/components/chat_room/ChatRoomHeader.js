import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import "./ChatRoomHeader.css";
import { icons } from "../../utils";
import { useNavigate } from "react-router-dom";

const ChatRoomHeader = ({ nickname }) => {
    const navigate = useNavigate();

    return (
        <div className="ChatRoomHeader">
            <FontAwesomeIcon
                icon={icons.faAngleLeft}
                style={{ cursor: "pointer" }}
                onClick={() => navigate(-1)}
            />
            <div className="nickname_wrapper">{nickname}</div>
            <div className="menu_wrapper">
                <FontAwesomeIcon icon={icons.faBars} style={{ cursor: "pointer" }} />
                <FontAwesomeIcon icon={icons.faMagnifyingGlass} style={{ cursor: "pointer" }} />
            </div>
        </div>
    );
};

export default ChatRoomHeader;