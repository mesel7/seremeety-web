import { useContext, useEffect, useState } from "react";
import BottomMenu from "../components/common/BottomMenu";
import PageHeader from "../components/common/PageHeader";
import { MatchingStateContext } from "../contexts/MatchingContext";
import MatchingContent from "../components/matching/MatchingContent";
import Loading from "../components/common/Loading";
import PageTransition from "../components/common/PageTransition";
import MatchingFilter from "../components/matching/MatchingFilter";
import { MypageStateContext } from "../contexts/MypageContext";
import Swal from "sweetalert2";
import { useNavigate } from "react-router-dom";

const Matching = () => {
    const state = useContext(MatchingStateContext);
    const userProfile = useContext(MypageStateContext);
    const navigate = useNavigate();
    console.log(state);
    const [openFilterModal, setOpenFilterModal] = useState(false);
    const [filters, setFilters] = useState({
        ageRange: [18, 30],
        place: ""
    });

    useEffect(() => {
        const savedFilters = sessionStorage.getItem("filters");
        if (savedFilters) {
            setFilters(JSON.parse(savedFilters));
        }
    }, []);

    useEffect(() => {
        sessionStorage.setItem("filters", JSON.stringify(filters));
    }, [filters]);

    const toggleFilterModal = () => {
        if (userProfile.profileStatus !== 1) {
            Swal.fire({
                title: "프로필 필터",
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
        setOpenFilterModal(prev => !prev);
    };

    const applyFilters = (newFilters) => {
        setFilters(newFilters);
        setOpenFilterModal(false);
    }

    if (!state) {
        return <Loading />;
    } else {
        return (
            <div className="Matching">
                <PageHeader page={"matching"} onFilterClick={toggleFilterModal} />
                {openFilterModal && (
                    <PageTransition direction={"y"}>
                        <MatchingFilter filters={filters} onApply={applyFilters} onClose={toggleFilterModal} />
                    </PageTransition>
                )}
                {!openFilterModal && (
                    <MatchingContent
                        profileCards={state}
                        filters={filters}
                        profileStatus={userProfile.profileStatus} />
                )}
                {!openFilterModal && <BottomMenu />}
            </div>
        );
    }
};

export default Matching;