import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "../../utils";
import BootPay from "bootpay-js";
import "./ShopItem.css";

const ShopItem = ({ quantity, discount, price, requestPayment }) => {
    return (
        <div className="ShopItem" onClick={() => requestPayment(quantity, price)}>
            <div className="quantity_section">
                <FontAwesomeIcon icon={icons.faMusic} />
                {quantity}
            </div>
            <div className="price_section">
                <div className="discount_wrapper">
                    {discount ? `${discount}% 할인` : ""}
                </div>
                <div className="price_wrapper">
                    {`₩ ${price.toLocaleString()}`}
                </div>
            </div>
        </div>
    );
};

export default ShopItem;