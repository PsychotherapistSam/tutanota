/* generated file, don't edit. */

import {IpcClientRect} from "./IpcClientRect.js"
import {UploadTaskResponse} from "./UploadTaskResponse.js"
import {DownloadTaskResponse} from "./DownloadTaskResponse.js"
import {DataFile} from "./DataFile.js"
export interface FileFacade {

	open(
		location: string,
		mimeType: string,
	): Promise<void>
	
	openFileChooser(
		boundingRect: IpcClientRect,
	): Promise<ReadonlyArray<string>>
	
	openFolderChooser(
	): Promise<string | null>
	
	deleteFile(
		file: string,
	): Promise<void>
	
	getName(
		file: string,
	): Promise<string>
	
	getMimeType(
		file: string,
	): Promise<string>
	
	getSize(
		file: string,
	): Promise<number>
	
	putFileIntoDownloadsFolder(
		localFileUri: string,
	): Promise<string>
	
	upload(
		fileUrl: string,
		targetUrl: string,
		method: string,
		headers: Record<string, string>,
	): Promise<UploadTaskResponse>
	
	download(
		sourceUrl: string,
		filename: string,
		headers: Record<string, string>,
	): Promise<DownloadTaskResponse>
	
	hashFile(
		fileUri: string,
	): Promise<string>
	
	clearFileData(
	): Promise<void>
	
	joinFiles(
		filename: string,
		files: ReadonlyArray<string>,
	): Promise<string>
	
	splitFile(
		fileUri: string,
		maxChunkSizeBytes: number,
	): Promise<ReadonlyArray<string>>
	
	writeDataFile(
		file: DataFile,
	): Promise<string>
	
	readDataFile(
		filePath: string,
	): Promise<DataFile | null>
	
}