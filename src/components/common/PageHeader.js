import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import "./PageHeader.css"
import { icons } from "../../utils";
import { useNavigate } from "react-router-dom";
import Button from "./Button";
import sereMeetyLogo from "../../images/img_seremeety_logo.png";

const PageHeader = ({ page, userProfile, onSaveProfile, onFilterClick, isReceived, setIsReceived }) => {
    const navigate = useNavigate();

    const renderHeaderElements = () => {
        switch (page) {
            case "matching":
                return (
                    <>
                        <h2>Profile Cards</h2>
                        <div className="header_menu">
                            <FontAwesomeIcon
                                icon={icons.faSliders}
                                style={{ cursor: "pointer" }}
                                onClick={onFilterClick}
                            />
                        </div>
                    </>
                );
            case "profile":
                return <h2>Profile</h2>;
            case "request":
                return (
                    <>
                        <h2>Request</h2>
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
            case "chat":
                return (
                    <>
                        <h2>Chatting</h2>
                        <div className="header_menu">
                            <FontAwesomeIcon
                                icon={icons.faMagnifyingGlass}
                                style={{ cursor: "pointer" }}
                            />
                        </div>
                    </>
                );
            case "mypage":
                return (
                    <>
                        <h2>Mypage</h2>
                        <div className="header_menu">
                            <div className="my_note" onClick={() => navigate("/shop")}>
                                <FontAwesomeIcon icon={icons.faMusic} />
                                {userProfile.coin}
                            </div>
                        </div>
                    </>
                );
            case "myProfile":
                return (
                    <>
                        <h2>My Profile</h2>
                        <div className="header_menu" onClick={() => onSaveProfile(userProfile)}>
                            저장
                        </div>
                    </>
                );
            case "shop":
                return (
                    <>
                        <h2>Shop</h2>
                        <div className="header_menu">
                            <div className="my_note">
                                <FontAwesomeIcon icon={icons.faMusic} />
                                {userProfile.coin}
                            </div>
                        </div>
                    </>
                );
            default: return null;
        }
    };

    return (
        <div className={["PageHeader", `PageHeader_${page}`].join(" ")}>
            <div className="logo_wrapper">
                <img alt={"LOGO"} src={sereMeetyLogo} onClick={() => navigate("/mypage")}/>
                Seremeety
            </div>
            <div className="content_wrapper">
                {renderHeaderElements()}
            </div>
        </div>
    );
};

export default PageHeader;