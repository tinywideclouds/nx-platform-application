import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { ContactsService } from './contacts.service';
import { LoggerService } from '@nx-platform-application/console-logger';
import { User } from '@nx-platform-application/platform-types';

// Mock Logger Service
// This is the standard Angular way to mock a dependent service.
class MockLoggerService {
  info = vi.fn();
  error = vi.fn();
  warn = vi.fn();
}

// Mock User Data
const MOCK_USERS: User[] = [
  { id: '1', email: 'user1@example.com', alias: 'User One' },
  { id: '2', email: 'user2@example.com', alias: 'User Two' },
];

describe('ContactsService (Zoneless)', () => {
  let service: ContactsService;
  let httpTestingController: HttpTestingController;
  let logger: LoggerService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule], // Import the testing module for HttpClient
      providers: [
        ContactsService,
        // Provide the mock logger
        { provide: LoggerService, useClass: MockLoggerService },
      ],
    });

    // Inject the services
    service = TestBed.inject(ContactsService);
    httpTestingController = TestBed.inject(HttpTestingController);
    logger = TestBed.inject(LoggerService);
  });

  afterEach(() => {
    // Verify that no unhandled requests are pending after each test
    httpTestingController.verify();
  });

  it('should load contacts on initialization', () => {
    // 1. Expect the initial GET request (from the constructor)
    const req = httpTestingController.expectOne('/api/contacts');
    expect(req.request.method).toBe('GET');

    // 2. Respond with mock data
    req.flush(MOCK_USERS);

    // 3. Verify the signal was updated
    expect(service.contacts()).toEqual(MOCK_USERS);
    // 4. Verify the logger was called
    expect(logger.info).toHaveBeenCalledWith(
      `[ContactsService] Loaded 2 contacts.`
    );
  });

  it('should handle errors during initial load', () => {
    // 1. Expect the initial GET request
    const req = httpTestingController.expectOne('/api/contacts');
    expect(req.request.method).toBe('GET');

    // 2. Respond with an error
    req.flush('Error', { status: 500, statusText: 'Server Error' });

    // 3. Verify the signal remains empty and the error was logged
    expect(service.contacts()).toEqual([]);
    expect(logger.error).toHaveBeenCalled();
  });

  it('should add a contact and then reload the list', () => {
    // 1. Flush the initial load from the constructor first
    httpTestingController.expectOne('/api/contacts').flush(MOCK_USERS);
    expect(service.contacts()).toEqual(MOCK_USERS); // Initial state

    // 2. Call addContact
    const newUserEmail = 'new@example.com';
    const NEW_USER: User = { id: '3', email: newUserEmail, alias: 'New User' };
    service.addContact(newUserEmail);

    // 3. Expect the POST request
    const postReq = httpTestingController.expectOne('/api/contacts');
    expect(postReq.request.method).toBe('POST');
    expect(postReq.request.body).toEqual({ email: newUserEmail });
    postReq.flush(NEW_USER);

    // 4. Expect the *new* GET request (from the automatic reload)
    const getReq = httpTestingController.expectOne('/api/contacts');
    expect(getReq.request.method).toBe('GET');

    // 5. Respond with the new, full list
    const UPDATED_LIST = [...MOCK_USERS, NEW_USER];
    getReq.flush(UPDATED_LIST);

    // 6. Verify the signal has the complete new list
    expect(service.contacts()).toEqual(UPDATED_LIST);
    expect(logger.info).toHaveBeenCalledWith(
      `[ContactsService] Successfully added contact: ${newUserEmail}`
    );
    expect(logger.info).toHaveBeenCalledWith(
      `[ContactsService] Loaded 3 contacts.`
    );
  });

  it('should handle errors during addContact', () => {
    // 1. Flush the initial load
    httpTestingController.expectOne('/api/contacts').flush(MOCK_USERS);

    // 2. Call addContact with an email that will fail
    service.addContact('fail@example.com');

    // 3. Expect the POST and respond with an error
    const postReq = httpTestingController.expectOne('/api/contacts');
    postReq.flush('Error', { status: 404, statusText: 'Not Found' });

    // 4. Verify no new GET request was made (because the POST failed)
    httpTestingController.expectNone('/api/contacts');

    // 5. Verify the signal is unchanged and the error was logged
    expect(service.contacts()).toEqual(MOCK_USERS);
    expect(logger.error).toHaveBeenCalled();
  });
});
