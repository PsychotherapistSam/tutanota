/* generated file, don't edit. */


import Foundation

/**
 * Contact-related funcionality on mobile.
 */
public protocol MobileContactsFacade {
	/**
	 * Find suggestions in the OS contact provider.
	 */
	func findSuggestions(
		_ query: String
	) async throws -> [ContactSuggestion]
	/**
	 * Store one or more contacts in system's contact book
	 */
	func saveContacts(
		_ username: String,
		_ contacts: [StructuredContact]
	) async throws -> Void
	/**
	 * Sync all Tuta contacts with system's contact book, this operation includes Inserts, Updates and Deletions
	 */
	func syncContacts(
		_ username: String,
		_ contacts: [StructuredContact]
	) async throws -> ContactSyncResult
	/**
	 * Get all contact books on the device.
	 */
	func getContactBooks(
	) async throws -> [ContactBook]
	/**
	 * Get all contacts in the specified contact book.
	 */
	func getContactsInContactBook(
		_ bookId: String
	) async throws -> [StructuredContact]
	/**
	 * Delete all or a specific Tuta contact from system's contact book
	 */
	func deleteContacts(
		_ username: String,
		_ contactId: String?
	) async throws -> Void
}
