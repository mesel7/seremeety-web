import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import "./PageHeader.css"
import { icons } from "../../utils";
import { useNavigate } from "react-router-dom";
import Button from "./Button";
import sereMeetyLogo from "../../images/img_seremeety_logo.png";

const PageHeader = ({ page, userProfile, onSaveProfile, isReceived, setIsReceived }) => {
    const navigate = useNavigate();

    const renderHeaderElements = () => {
        switch (page) {
            case "matching": return <h2>프로필 카드</h2>;
            case "profile": return <h2>상세 프로필</h2>;
            case "request":
                return (
                    <>
                        <h2>요청</h2>
                        <div className="header_menu">
                            <Button
                                text="받은 요청"
                                type={isReceived ? "" : "light"}
                                onClick={() => setIsReceived(true)}
                            />
                            <Button
                                text="보낸 요청"
                                type={isReceived ? "light" : ""}
                                onClick={() => setIsReceived(false)}
                            />
                        </div>
                    </>
                );
            case "chat": return <h2>채팅</h2>;
            case "mypage":
                return (
                    <>
                        <h2>마이페이지</h2>
                        <div className="header_menu">
                            <div className="my_note" onClick={() => navigate("/shop")}>
                                나의 음표
                                <FontAwesomeIcon icon={icons.faMusic} style={{ color: "black" }} />
                                0
                            </div>
                        </div>
                    </>
                );
            case "myProfile":
                return (
                    <>
                        <h2>내 프로필</h2>
                        <div className="header_menu">
                            <Button
                                text="저장"
                                onClick={() => onSaveProfile(userProfile)}
                            />
                        </div>
                    </>
                );
            case "shop": return <h2>상점</h2>;
            default: return null;
        }
    };

    return (
        <div className={["PageHeader", `PageHeader_${page}`].join(" ")}>
            <div className="logo_wrapper">
                <img alt={"LOGO"} src={sereMeetyLogo} />
                SEREMEETY
            </div>
            <div className="content_wrapper">
                {renderHeaderElements()}
            </div>
        </div>
    );
};

export default PageHeader;