import { mypageForm } from "../utils";
import Button from "./Button";
import MypageForm from "./MypageForm";
import "./PageContent.css";

const PageContent = ({ page }) => {
    const renderContentElements = () => {
        switch (page) {
            case "matching": return null;
            case "request": return null;
            case "chat": return null;
            case "mypage":
                return (
                    <>
                        <img alt="PROFILE" src="/logo192.png" />
                        {mypageForm.map((it, idx) => <MypageForm key={idx} {...it}/>)}
                        <Button text={"저장하기"} />
                    </>
                );
            case "shop": return null;
            default: return null;
        }
    };

    return (
        <div className={["PageContent", `PageContent_${page}`].join(" ")}>
            {renderContentElements()}
        </div>
    );
};

export default PageContent;