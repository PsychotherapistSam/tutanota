/* generated file, don't edit. */


package de.tutao.tutanota.ipc

import kotlinx.serialization.*
import kotlinx.serialization.json.*


@Serializable
data class StructuredAddress(
	val address: String,
	val type: ContactAddressType,
	val customTypeName: String,
)
