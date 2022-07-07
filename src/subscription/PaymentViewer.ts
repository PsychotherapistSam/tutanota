import m, {Children} from "mithril"
import {assertMainOrNode, isIOSApp} from "../api/common/Env"
import {assertNotNull, neverNull, noOp, ofClass, promiseMap} from "@tutao/tutanota-utils"
import {lang, TranslationKey} from "../misc/LanguageViewModel"
import type {AccountingInfo, Booking, Customer, InvoiceInfo} from "../api/entities/sys/TypeRefs.js"
import {
	AccountingInfoTypeRef,
	BookingTypeRef,
	createDebitServicePutData,
	CustomerInfoTypeRef,
	CustomerTypeRef,
	InvoiceInfoTypeRef
} from "../api/entities/sys/TypeRefs.js"
import {HtmlEditor, HtmlEditorMode} from "../gui/editor/HtmlEditor"
import {formatPrice, getPaymentMethodInfoText, getPaymentMethodName} from "./PriceUtils"
import * as InvoiceDataDialog from "./InvoiceDataDialog"
import {Icons} from "../gui/base/icons/Icons"
import {ColumnWidth, TableLineAttrs, TableN} from "../gui/base/TableN"
import {Button, ButtonType} from "../gui/base/Button.js"
import {formatDate, formatNameAndAddress} from "../misc/Formatter"
import {getPaymentMethodType, PaymentMethodType, PostingType} from "../api/common/TutanotaConstants"
import {BadGatewayError, LockedError, PreconditionFailedError, TooManyRequestsError} from "../api/common/error/RestError"
import {Dialog, DialogType} from "../gui/base/Dialog"
import {getByAbbreviation} from "../api/common/CountryList"
import * as PaymentDataDialog from "./PaymentDataDialog"
import {showProgressDialog} from "../gui/dialogs/ProgressDialog"
import type {EntityUpdateData} from "../api/main/EventController"
import {isUpdateForTypeRef} from "../api/main/EventController"
import stream from "mithril/stream"
import Stream from "mithril/stream"
import {getPreconditionFailedPaymentMsg} from "./SubscriptionUtils"
import type {DialogHeaderBarAttrs} from "../gui/base/DialogHeaderBar"
import {DialogHeaderBar} from "../gui/base/DialogHeaderBar"
import {TextFieldN} from "../gui/base/TextFieldN"
import {logins} from "../api/main/LoginController"
import type {CustomerAccountPosting} from "../api/entities/accounting/TypeRefs"
import {createCustomerAccountPosting} from "../api/entities/accounting/TypeRefs"
import {ExpanderButtonN, ExpanderPanelN} from "../gui/base/Expander"
import {locator} from "../api/main/MainLocator"
import {createNotAvailableForFreeClickHandler} from "../misc/SubscriptionDialogs"
import type {UpdatableSettingsViewer} from "../settings/SettingsView"
import {TranslationKeyType} from "../misc/TranslationKey";
import {CustomerAccountService} from "../api/entities/accounting/Services"
import {DebitService} from "../api/entities/sys/Services"

assertMainOrNode()

export class PaymentViewer implements UpdatableSettingsViewer {
	private readonly _invoiceAddressField: HtmlEditor
	private _customer: Customer | null = null
	private _accountingInfo: AccountingInfo | null = null
	private _postings: CustomerAccountPosting[]
	private _outstandingBookingsPrice: number | null = null
	private _lastBooking: Booking | null
	private _paymentBusy: boolean
	private _invoiceInfo: InvoiceInfo | null = null
	view: UpdatableSettingsViewer["view"]

	constructor() {
		this._invoiceAddressField = new HtmlEditor()
			.setMinHeight(140)
			.showBorders()
			.setMode(HtmlEditorMode.HTML)
			.setHtmlMonospace(false)
			.setEnabled(false)
			.setPlaceholderId("invoiceAddress_label")
		const changeInvoiceDataButtonAttrs = {
			label: "invoiceData_msg",
			click: createNotAvailableForFreeClickHandler(
				true,
				() => {
					if (this._accountingInfo) {
						const accountingInfo = neverNull(this._accountingInfo)
						const invoiceCountry = accountingInfo.invoiceCountry ? getByAbbreviation(accountingInfo.invoiceCountry) : null
						InvoiceDataDialog.show(
							neverNull(neverNull(this._customer).businessUse),
							{
								invoiceAddress: formatNameAndAddress(accountingInfo.invoiceName, accountingInfo.invoiceAddress),
								country: invoiceCountry,
								vatNumber: accountingInfo.invoiceVatIdNo,
							},
							accountingInfo,
						)
					}
				},
				() => logins.getUserController().isPremiumAccount(),
			),
			icon: () => Icons.Edit,
		} as const
		this._postings = []
		this._lastBooking = null
		this._paymentBusy = false
		const postingExpanded = stream(false)

		this.view = (): Children => {
			const changePaymentDataButtonAttrs = {
				label: "paymentMethod_label",
				click: createNotAvailableForFreeClickHandler(
					true,
					() => {
						if (this._accountingInfo) {
							let nextPayment = this._postings.length ? Number(this._postings[0].balance) * -1 : 0
							showProgressDialog(
								"pleaseWait_msg",
								locator.bookingFacade.getCurrentPrice().then(priceServiceReturn => {
									return Math.max(
										nextPayment,
										Number(neverNull(priceServiceReturn.currentPriceThisPeriod).price),
										Number(neverNull(priceServiceReturn.currentPriceNextPeriod).price),
									)
								}),
							).then(price => {
								return PaymentDataDialog.show(neverNull(this._customer), neverNull(this._accountingInfo), price).then(success => {
									if (success) {
										if (this._isPayButtonVisible()) {
											return this._showPayDialog(this._amountOwed())
										}
									}
								})
							})
						}
					}, // iOS app doesn't work with PayPal button or 3dsecure redirects
					() => !isIOSApp() && logins.getUserController().isPremiumAccount(),
				),
				icon: () => Icons.Edit,
			} as const
			const invoiceVatId = this._accountingInfo ? this._accountingInfo.invoiceVatIdNo : lang.get("loading_msg")
			const paymentMethodHelpLabel = () => {
				if (this._accountingInfo && getPaymentMethodType(this._accountingInfo) === PaymentMethodType.Invoice) {
					return lang.get("paymentProcessingTime_msg")
				}

				return ""
			}

			const paymentMethod = this._accountingInfo
				? getPaymentMethodName(getPaymentMethodType(neverNull(this._accountingInfo))) + " " + getPaymentMethodInfoText(neverNull(this._accountingInfo))
				: lang.get("loading_msg")
			return m(
				"#invoicing-settings.fill-absolute.scroll.plr-l",
				{
					role: "group",
				},
				[
					m(".flex-space-between.items-center.mt-l.mb-s", [
						m(".h4", lang.get("invoiceData_msg")),
						m(".mr-negative-s", m(Button, changeInvoiceDataButtonAttrs)),
					]),
					m(this._invoiceAddressField),
					this._accountingInfo && this._accountingInfo.invoiceVatIdNo.trim().length > 0
						? m(TextFieldN, {
							label: "invoiceVatIdNo_label",
							value: invoiceVatId,
							disabled: true,
						})
						: null,
					m(TextFieldN, {
						label: "paymentMethod_label",
						value: paymentMethod,
						helpLabel: paymentMethodHelpLabel,
						disabled: true,
						injectionsRight: () => [m(Button, changePaymentDataButtonAttrs)],
					}),
					this._renderPostings(postingExpanded),
				],
			)
		}

		locator.entityClient
			   .load(CustomerTypeRef, neverNull(logins.getUserController().user.customer))
			   .then(customer => {
				   this._customer = customer
				   return locator.entityClient.load(CustomerInfoTypeRef, customer.customerInfo)
			   })
			   .then(customerInfo => locator.entityClient.load(AccountingInfoTypeRef, customerInfo.accountingInfo))
			   .then(accountingInfo => {
				   this._updateAccountingInfoData(accountingInfo)

				   locator.entityClient.load(InvoiceInfoTypeRef, neverNull(accountingInfo.invoiceInfo)).then(invoiceInfo => {
					   this._invoiceInfo = invoiceInfo
					   m.redraw()
				   })
			   })
			   .then(() => this._loadPostings())
			   .then(() => this._loadBookings())
	}

	_renderPostings(postingExpanded: Stream<boolean>): Children {
		if (!this._postings || this._postings.length === 0) {
			return null
		} else {
			const balance = Number.parseFloat(this._postings[0].balance)
			return [
				m(".h4.mt-l", lang.get("currentBalance_label")),
				m(".flex.center-horizontally.center-vertically.col", [
					m(
						"div.h4.pt.pb" + (this._isAmountOwed() ? ".content-accent-fg" : ""),
						formatPrice(balance, true) + (this._accountBalance() !== balance ? ` (${formatPrice(this._accountBalance(), true)})` : ""),
					),
					this._accountBalance() !== balance
						? m(
							".small" + (this._accountBalance() < 0 ? ".content-accent-fg" : ""),
							lang.get("unprocessedBookings_msg", {
								"{amount}": formatPrice(assertNotNull(this._outstandingBookingsPrice), true),
							}),
						)
						: null,
					this._isPayButtonVisible()
						? m(
							".pb",
							{
								style: {
									width: "200px",
								},
							},
							m(Button, {
								label: "invoicePay_action",
								type: ButtonType.Login,
								click: () => this._showPayDialog(this._amountOwed()),
							}),
						)
						: null,
				]),
				this._accountingInfo &&
				this._accountingInfo.paymentMethod !== PaymentMethodType.Invoice &&
				(this._isAmountOwed() || (this._invoiceInfo && this._invoiceInfo.paymentErrorInfo))
					? this._invoiceInfo && this._invoiceInfo.paymentErrorInfo
						? m(".small.underline.b", lang.get(getPreconditionFailedPaymentMsg(this._invoiceInfo.paymentErrorInfo.errorCode)))
						: m(".small.underline.b", lang.get("failedDebitAttempt_msg"))
					: null,
				m(".flex-space-between.items-center.mt-l.mb-s", [
					m(".h4", lang.get("postings_label")),
					m(ExpanderButtonN, {
						label: "show_action",
						expanded: postingExpanded(),
						onExpandedChange: postingExpanded,
					}),
				]),
				m(ExpanderPanelN, {
						expanded: postingExpanded(),
					},
					m(TableN, {
						columnHeading: ["type_label", "amount_label"],
						columnWidths: [ColumnWidth.Largest, ColumnWidth.Small, ColumnWidth.Small],
						columnAlignments: [false, true, false],
						showActionButtonColumn: true,
						lines: this._postings.map((posting: CustomerAccountPosting) => {
							return {
								cells: () => [
									{
										main: getPostingTypeText(posting),
										info: [formatDate(posting.valueDate)],
									},
									{
										main: formatPrice(Number(posting.amount), true),
									},
								],
								actionButtonAttrs:
									posting.type === PostingType.UsageFee || posting.type === PostingType.Credit
										? {
											label: "download_action",
											icon: () => Icons.Download,
											click: () => {
												showProgressDialog(
													"pleaseWait_msg",
													locator.customerFacade.downloadInvoice(neverNull(posting.invoiceNumber)),
												).then(pdfInvoice => locator.fileController.saveDataFile(pdfInvoice))
											},
										}
										: null,
							} as TableLineAttrs
						}),
					}),
				),
				m(".small", lang.get("invoiceSettingDescription_msg") + " " + lang.get("laterInvoicingInfo_msg")),
			]
		}
	}

	_updateAccountingInfoData(accountingInfo: AccountingInfo) {
		this._accountingInfo = accountingInfo

		this._invoiceAddressField.setValue(formatNameAndAddress(accountingInfo.invoiceName, accountingInfo.invoiceAddress, accountingInfo.invoiceCountry ?? undefined))

		m.redraw()
	}

	_accountBalance(): number {
		const balance = this._postings && this._postings.length > 0 ? Number(this._postings[0].balance) : 0
		return balance - assertNotNull(this._outstandingBookingsPrice)
	}

	_amountOwed(): number {
		if (this._postings != null && this._postings.length > 0) {
			let balance = Number(this._postings[0].balance)

			if (balance < 0) {
				return balance
			}
		}

		return 0
	}

	_isAmountOwed(): boolean {
		return this._amountOwed() < 0
	}

	_loadBookings(): Promise<void> {
		return logins
			.getUserController()
			.loadCustomer()
			.then(customer => locator.entityClient.load(CustomerInfoTypeRef, customer.customerInfo))
			.then(customerInfo => (customerInfo.bookings ? locator.entityClient.loadAll(BookingTypeRef, customerInfo.bookings.items) : []))
			.then(bookings => {
				this._lastBooking = bookings[bookings.length - 1]
				m.redraw()
			})
	}

	_loadPostings(): Promise<void> {
		return locator.serviceExecutor.get(CustomerAccountService, null).then(result => {
			this._postings = result.postings
			this._outstandingBookingsPrice = Number(result.outstandingBookingsPrice)
			m.redraw()
		})
	}

	entityEventsReceived(updates: ReadonlyArray<EntityUpdateData>): Promise<void> {
		return promiseMap(updates, update => {
			return this.processUpdate(update)
		}).then(noOp)
	}

	processUpdate(update: EntityUpdateData): Promise<void> {
		const {instanceId} = update

		if (isUpdateForTypeRef(AccountingInfoTypeRef, update)) {
			return locator.entityClient.load(AccountingInfoTypeRef, instanceId).then(accountingInfo => this._updateAccountingInfoData(accountingInfo))
		} else if (isUpdateForTypeRef(CustomerTypeRef, update)) {
			return locator.entityClient.load(CustomerTypeRef, instanceId).then(customer => {
				this._customer = customer
			})
		} else if (isUpdateForTypeRef(InvoiceInfoTypeRef, update)) {
			return locator.entityClient.load(InvoiceInfoTypeRef, instanceId).then(invoiceInfo => {
				this._invoiceInfo = invoiceInfo
				m.redraw()
			})
		} else {
			return Promise.resolve()
		}
	}

	_isPayButtonVisible(): boolean {
		return (
			this._accountingInfo != null &&
			(this._accountingInfo.paymentMethod === PaymentMethodType.CreditCard || this._accountingInfo.paymentMethod === PaymentMethodType.Paypal) &&
			this._isAmountOwed()
		)
	}

	_showPayDialog(openBalance: number): Promise<void> {
		this._paymentBusy = true
		return _showPayConfirmDialog(openBalance)
			.then(confirmed => {
				if (confirmed) {
					return showProgressDialog(
						"pleaseWait_msg",
						locator.serviceExecutor.put(DebitService, createDebitServicePutData())
							   .then(() => {
								   // accounting is updated async but we know that the balance will be 0 when the payment was successful.
								   let mostCurrentPosting = this._postings[0]
								   let newPosting = createCustomerAccountPosting({
									   valueDate: new Date(),
									   amount: String(-Number.parseFloat(mostCurrentPosting.balance)),
									   balance: "0",
									   type: PostingType.Payment,
								   })

								   this._postings.unshift(newPosting)

								   m.redraw()
							   })
							   .catch(ofClass(LockedError, () => "operationStillActive_msg" as TranslationKey))
							   .catch(
								   ofClass(PreconditionFailedError, error => {
									   return getPreconditionFailedPaymentMsg(error.data)
								   }),
							   )
							   .catch(ofClass(BadGatewayError, () => "paymentProviderNotAvailableError_msg" as TranslationKey))
							   .catch(ofClass(TooManyRequestsError, () => "tooManyAttempts_msg" as TranslationKey)),
					)
				}
			})
			.then((errorId: TranslationKeyType | void) => {
				if (errorId) {
					return Dialog.message(errorId)
				}
			})
			.finally(() => (this._paymentBusy = false))
	}
}

function _showPayConfirmDialog(price: number): Promise<boolean> {
	return new Promise(resolve => {
		let dialog: Dialog

		const doAction = (res: boolean) => {
			dialog.close()
			resolve(res)
		}

		const actionBarAttrs: DialogHeaderBarAttrs = {
			left: [
				{
					label: "cancel_action",
					click: () => doAction(false),
					type: ButtonType.Secondary,
				},
			],
			right: [
				{
					label: "invoicePay_action",
					click: () => doAction(true),
					type: ButtonType.Primary,
				},
			],
			middle: () => lang.get("adminPayment_action"),
		}
		dialog = new Dialog(DialogType.EditSmall, {
			view: (): Children => [
				m(".dialog-header.plr-l", m(DialogHeaderBar, actionBarAttrs)),
				m(
					".plr-l.pb",
					m("", [
						m(".pt", lang.get("invoicePayConfirm_msg")),
						m(TextFieldN, {
							label: "price_label",
							value: formatPrice(-price, true),
							disabled: true,
						}),
					]),
				),
			],
		})
			.setCloseHandler(() => doAction(false))
			.show()
	})
}

function getPostingTypeText(posting: CustomerAccountPosting): string {
	switch (posting.type) {
		case PostingType.UsageFee:
			return lang.get("invoice_label")

		case PostingType.Credit:
			return lang.get("credit_label")

		case PostingType.Payment:
			return lang.get("adminPayment_action")

		case PostingType.Refund:
			return lang.get("refund_label")

		case PostingType.GiftCard:
			return Number(posting.amount) < 0
				? lang.get("boughtGiftCardPosting_label")
				: lang.get("redeemedGiftCardPosting_label")

		default:
			return ""
		// Generic, Dispute, Suspension, SuspensionCancel
	}
}