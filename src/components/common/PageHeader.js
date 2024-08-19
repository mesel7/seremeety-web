import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import "./PageHeader.css"
import { icons } from "../../utils";
import { useNavigate } from "react-router-dom";
import Button from "./Button";

const PageHeader = ({ page, setIsReceived }) => {
    const navigate = useNavigate();

    const handleSettingClick = () => {
        navigate("/setting");
    };

    const renderHeaderElements = () => {
        switch (page) {
            case "matching": return <h2>프로필 카드</h2>;
            case "profile": return <h2>상세 프로필</h2>;
            case "request":
                return (
                    <>
                        <h2>요청</h2>
                        <div className="header_menu">
                            <Button text="받은 요청" onClick={() => setIsReceived(true)} />
                            <Button text="보낸 요청" onClick={() => setIsReceived(false)} />
                        </div>
                    </>
                );
            case "chat": return <h2>채팅</h2>;
            case "mypage":
                return (
                    <>
                        <h2>내 프로필</h2>
                        <div className="header_menu">
                            <div className="my_note">
                                나의 음표
                                <FontAwesomeIcon icon={icons.faMusic} style={{ color: "black" }} />
                                0
                            </div>
                            <div className="setting" onClick={handleSettingClick}>
                                <FontAwesomeIcon icon={icons.faGear} style={{ color: "black" }} />
                            </div>
                        </div>
                    </>
                );
            case "shop": return <h2>상점</h2>;
            case "setting": return <h2>설정</h2>;
            default: return null;
        }
    };

    return (
        <div className={["PageHeader", `PageHeader_${page}`].join(" ")}>
            {renderHeaderElements()}
        </div>
    );
};

export default PageHeader;