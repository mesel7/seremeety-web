import { useMemo, useState } from "react";
import "./MatchingContent.css";
import ProfileCardItem from "./ProfileCardItem";
import Button from "../common/Button";
import Swal from "sweetalert2";
import { useNavigate } from "react-router-dom";

const MatchingContent = ({ profileCards, filters, profileStatus, style }) => {
    const [visibleCount, setVisibleCount] = useState(4);
    const navigate = useNavigate();

    const filteredCards = useMemo(() => {
        return profileCards.filter(it => {
            const place = it.place || '';
            const filterPlace = filters.place || '';

            const isValidAgeRange = filters.ageRange[0] <= filters.ageRange[1];
            const isValidPlace = filterPlace.trim() !== '';

            const age = parseInt(it.age.match(/\d+/)[0], 10);

            return (
                (isValidAgeRange ? (age >= filters.ageRange[0] && age <= filters.ageRange[1]) : true) &&
                (isValidPlace ? (place.includes(filterPlace)) : true)
            );
        });
    }, [profileCards, filters]);

    const showMoreCards = () => {
        if (profileStatus !== 1) {
            Swal.fire({
                title: "프로필 더 보기",
                text: "먼저 프로필을 완성해주세요",
                icon: "warning",
                confirmButtonText: "확인",
                customClass: {
                    confirmButton: 'no-focus-outline'
                },
                willClose: () => {
                    navigate("/my-profile", { replace: true });
                }
            });
            return;
        }
        setVisibleCount(prevCount => prevCount + 4);
    };

    return (
        <div className="MatchingContent" style={style}>
            <div className="card_section">
                {filteredCards.slice(0, visibleCount).map((it, idx) => (
                    <ProfileCardItem key={idx} {...it} profileStatus={profileStatus} />
                ))}
            </div>
            <div className="option_section">
                {visibleCount < filteredCards.length && (
                    <Button text={"프로필 더 보기"} type={"light"} onClick={showMoreCards}/>
                )}
                {visibleCount >= filteredCards.length && (
                    <div className="no_more_cards">더 이상 프로필이 없어요</div>
                )}
            </div>
        </div>
    );
};

export default MatchingContent;