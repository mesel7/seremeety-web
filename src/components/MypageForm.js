import "./MypageForm.css";

const MypageForm = ({ field, type, id, options }) => {
    return (
        <div className={["MypageForm", `MypageForm_${id}`].join(" ")}>
            <label htmlFor={id}>{field}</label>
            {type === "text" && <input type={type} id={id} />}
            {type === "date" && <input type={type} id={id} />}
            {type === "radio" && options.map((it, idx) => (
                <div className="radio_wrapper" key={idx}>
                    <input type={type} id={`${id}-${it === "남성" ? "male" : "female"}`} name={id}/>
                    <label htmlFor={`${id}-${it === "남성" ? "male" : "female"}`}>{it}</label>
                </div>
            ))}
            {type === "select" && (
                <select id={id}>
                    {options.map((it, idx) => <option key={idx}>{it}</option>)}
                </select>
            )}
            {type=== "textarea" && <textarea id={id} />}
        </div>
    );
};

export default MypageForm;