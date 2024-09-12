import { useState } from "react";
import "./MatchingFilter.css";
import Button from "../common/Button";
import Select from "react-select";
import { placeList } from "../../places";

const MatchingFilter = ({ filters, onApply, onClose }) => {
    const [ageRange, setAgeRange] = useState(filters.ageRange);
    const [place, setPlace] = useState(filters.place);

    const mainPlaceOptions = placeList.map(([it]) => ({ value: it, label: it }));

    const setYoungerAgeRange = (e) => {
        const input = e.target.value;
        if (/^[\d-]*$/.test(input)) {
            const youngerAge = input === "" ? "" : +input;
            setAgeRange([youngerAge, Math.max(youngerAge, ageRange[1])]);
        }
    };

    const setElderAgeRange = (e) => {
        const input = e.target.value;
        if (/^[\d-]*$/.test(input)) {
            const elderAge = input === "" ? "" : +input;
            setAgeRange([ageRange[0], elderAge]);
        }
    };

    const handleApply = () => {
        const minAge = parseInt(ageRange[0], 10);
        const maxAge = parseInt(ageRange[1], 10);
        const isAgeValid = !isNaN(minAge) && !isNaN(maxAge) && minAge <= maxAge;

        onApply({
            ageRange: isAgeValid ? [minAge, maxAge] : [18, 30],
            place: place.trim() !== "" ? place : ""
        });
    };

    return (
        <div className="MatchingFilter">
            <h2>Matching Filters</h2>
            <div className="filter_content">
                <div className="age_filter">
                    <h3>매칭 상대 나이</h3>
                    <div className="age_wrapper">
                        <input
                            type="tel"
                            maxLength={2}
                            value={ageRange[0]}
                            onChange={setYoungerAgeRange}
                        />
                        <span>세 이상</span>
                        <input
                            type="tel"
                            maxLength={2}
                            value={ageRange[1]}
                            onChange={setElderAgeRange}
                        />
                        <span>세 이하</span>
                    </div>
                </div>
                <div className="place_filter">
                    <h3>매칭 상대 지역</h3>
                    <Select
                        classNamePrefix={"mypage-select"}
                        value={mainPlaceOptions.find(option => option.value === place) || null}
                        onChange={(selectedOption) => setPlace(selectedOption ? selectedOption.value : "")}
                        options={mainPlaceOptions}
                        placeholder="지역"
                        noOptionsMessage={() => ""}
                        isClearable
                    />
                </div>
            </div>
            <div className="filter_menu">
                <Button text="닫기" type="light" onClick={onClose} />
                <Button text="적용" onClick={handleApply} />
            </div>
        </div>
    );
};

export default MatchingFilter;
