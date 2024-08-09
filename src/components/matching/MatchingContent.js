import "./MatchingContent.css";
import ProfileCardItem from "./ProfileCardItem";

const MatchingContent = ({ profileCards }) => {
    return (
        <div className="MatchingContent">
            {profileCards.map((it, idx) => (
                <ProfileCardItem key={idx} {...it} />
            ))}
        </div>
    );
};

export default MatchingContent;