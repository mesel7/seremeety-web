import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import "./PageHeader.css"
import { icons } from "../utils";

const PageHeader = ({ page }) => {
    const renderHeaderElements = () => {
        switch (page) {
            case "matching": return <h2>프로필 카드</h2>;
            case "request": return <h2>요청</h2>;
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
                            <div className="setting">
                                <FontAwesomeIcon icon={icons.faGear} style={{ color: "black" }} />
                            </div>
                        </div>
                    </>
                );
            case "shop": return <h2>상점</h2>;
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