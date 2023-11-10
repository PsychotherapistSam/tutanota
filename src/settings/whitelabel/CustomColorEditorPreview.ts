import m, { Children, Component } from "mithril"
import { px, size } from "../../gui/size"
import { Button, ButtonType } from "../../gui/base/Button.js"
import { createMail, createMailAddress } from "../../api/entities/tutanota/TypeRefs.js"
import { MailRow } from "../../mail/view/MailRow"
import { noOp } from "@tutao/tutanota-utils"
import { IconButton } from "../../gui/base/IconButton.js"
import { Icons } from "../../gui/base/icons/Icons.js"
import { ToggleButton } from "../../gui/base/buttons/ToggleButton.js"

export const BUTTON_WIDTH = 270

export class CustomColorEditorPreview implements Component {
	_mailRow: MailRow
	_mailRow2: MailRow
	private toggleSelected: boolean = false

	constructor() {
		this._mailRow = new MailRow(false, noOp)
		this._mailRow2 = new MailRow(false, noOp)
	}

	view(): Children {
		return m(
			".editor-border.mt-l.flex.col",
			{
				style: {
					alignItems: "center",
				},
			},
			[
				m(
					".pt",
					{
						style: {
							width: px(BUTTON_WIDTH),
						},
					},
					m(Button, {
						label: "login_action",
						click: noOp,
						type: ButtonType.Login,
					}),
				),
				m(".pt", [
					m(Button, {
						label: () => "Secondary",
						click: noOp,
						type: ButtonType.Secondary,
					}),
					m(Button, {
						label: () => "Primary",
						click: noOp,
						type: ButtonType.Primary,
					}),
				]),
				m(".pt", [
					m(IconButton, {
						title: () => "Icon button",
						icon: Icons.Folder,
						click: noOp,
					}),
					m(ToggleButton, {
						title: () => "Toggle button",
						icon: this.toggleSelected ? Icons.Lock : Icons.Unlock,
						toggled: this.toggleSelected,
						onToggled: () => (this.toggleSelected = !this.toggleSelected),
					}),
				]),
				m(".pt", this.renderPreviewMailRow()),
			],
		)
	}

	renderPreviewMailRow(): Children {
		const mail = createMail({
			sender: createMailAddress({
				address: "m.mustermann@example.com",
				name: "Max Mustermann",
				contact: null,
			}),
			receivedDate: new Date(),
			subject: "Mail 1",
			unread: false,
			replyType: "0",
			confidential: true,
			attachments: [],
			state: "2",
			mailDetails: null,
			body: null,
			authStatus: null,
			method: "0",
			bccRecipients: [],
			bucketKey: null,
			ccRecipients: [],
			headers: null,
			// @ts-ignore
			conversationEntry: null, // FIXME
			differentEnvelopeSender: null,
			firstRecipient: null,
			listUnsubscribe: false,
			mailDetailsDraft: null,
			movedTime: null,
			phishingStatus: "0",
			recipientCount: "0",
			replyTos: [],
			restrictions: null,
			sentDate: null,
			toRecipients: [],
		})
		const mail2 = createMail({
			sender: createMailAddress({
				address: "m.mustermann@example.com",
				name: "Max Mustermann",
				contact: null,
			}),
			receivedDate: new Date(),
			subject: "Mail 2",
			unread: true,
			replyType: "1",
			confidential: false,
			attachments: [],
			state: "2",
			authStatus: null,
			sentDate: null,
			phishingStatus: "0",
			mailDetailsDraft: null,
			// @ts-ignore
			conversationEntry: null, // FIXME
			headers: null,
			mailDetails: null,
		})
		return m(
			".rel",
			{
				style: {
					width: px(size.second_col_max_width),
					height: px(size.list_row_height * 2),
				},
			},
			[
				m(
					".list-row.pl.pr-l.odd-row.pt.pb",
					{
						oncreate: (vnode) => {
							this._mailRow.domElement = vnode.dom as HTMLElement
							requestAnimationFrame(() => this._mailRow.update(mail, false, false))
						},
					},
					this._mailRow.render(),
				),
				m(
					".list-row.pl.pr-l.pt.pb",
					{
						oncreate: (vnode) => {
							this._mailRow2.domElement = vnode.dom as HTMLElement
							requestAnimationFrame(() => this._mailRow2.update(mail2, true, false))
						},
						style: {
							top: px(size.list_row_height),
						},
					},
					this._mailRow2.render(),
				),
			],
		)
	}
}
