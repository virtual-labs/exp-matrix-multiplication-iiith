        class MPISimulation {
            constructor() {
                this.isRunning = false;
                this.processes = [];
                this.currentMatrixSize = 2;
                this.animationSpeed = 1.0;
                this.isStepMode = false;
                this.stepQueue = [];
                this.currentStep = 0;
                this.setupEventListeners();
                this.updateProcessCountOptions();
                this.initializeProcesses();
                this.generateMatrices();
                this.updateConfigDisplay();
            }

            setupEventListeners() {
                document.getElementById('startBtn').addEventListener('click', () => this.startSimulation());
                document.getElementById('processCountSelector').addEventListener('change', () => {
                    this.initializeProcesses();
                    this.generateMatrices();
                    this.updateConfigDisplay();
                });
                document.getElementById('matrixSizeSelector').addEventListener('change', () => {
                    this.updateProcessCountOptions();
                    this.generateMatrices();
                    this.updateConfigDisplay();
                });
                document.getElementById('matrixMode').addEventListener('change', (e) => {
                    const randomizeBtn = document.getElementById('randomizeBtn');
                    if (e.target.value === 'manual') {
                        randomizeBtn.style.display = 'block';
                        this.enableMatrixEditing();
                    } else {
                        randomizeBtn.style.display = 'none';
                        this.disableMatrixEditing();
                        this.generateMatrices();
                    }
                });
                document.getElementById('randomizeBtn').addEventListener('click', () => this.generateMatrices());
                document.getElementById('downloadMPICode').addEventListener('click', () => this.downloadMPICode());
                
                // Speed control
                document.getElementById('speedSlider').addEventListener('input', (e) => {
                    this.animationSpeed = parseFloat(e.target.value);
                    document.getElementById('speedValue').textContent = `${this.animationSpeed.toFixed(1)}x`;
                });
                
                // Execution mode control
                document.getElementById('executionMode').addEventListener('change', (e) => {
                    this.isStepMode = e.target.value === 'step';
                    const stepBtn = document.getElementById('stepBtn');
                    const startBtn = document.getElementById('startBtn');
                    
                    if (this.isStepMode) {
                        stepBtn.style.display = 'block';
                        if (this.isRunning) {
                            startBtn.style.display = 'none';
                        }
                    } else {
                        stepBtn.style.display = 'none';
                        startBtn.style.display = 'block';
                    }
                });
                
                // Step button
                document.getElementById('stepBtn').addEventListener('click', () => this.executeNextStep());
            }

            initializeProcesses() {
                const processCount = parseInt(document.getElementById('processCountSelector').value);
                const grid = document.getElementById('processGrid');
                const cols = Math.ceil(Math.sqrt(processCount));
                grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
                grid.innerHTML = '';
                this.processes = [];

                for (let i = 0; i < processCount; i++) {
                    const processNode = document.createElement('div');
                    processNode.className = 'process-node';
                    processNode.innerHTML = `
                        <div class="process-id">Process ${i} ${i === 0 ? '(Master)' : ''}</div>
                        <div class="process-status">Idle</div>
                        <div class="process-data"></div>`;
                    grid.appendChild(processNode);
                    this.processes.push({ 
                        id: i, 
                        element: processNode, 
                        status: 'idle', 
                        data: null 
                    });
                }
            }

            generateMatrices() {
                const size = parseInt(document.getElementById('matrixSizeSelector').value);
                this.matrixA = this.createRandomMatrix(size);
                this.matrixB = this.createRandomMatrix(size);
                this.matrixC = this.createZeroMatrix(size);
                this.renderMatrix('matrixA', this.matrixA);
                this.renderMatrix('matrixB', this.matrixB);
                this.renderMatrix('matrixC', this.matrixC);
                this.updateConfigDisplay();
            }

            createRandomMatrix(size) {
                return Array.from({ length: size }, () => 
                    Array.from({ length: size }, () => Math.floor(Math.random() * 10))
                );
            }

            createZeroMatrix(size) {
                return Array.from({ length: size }, () => Array(size).fill(0));
            }

            renderMatrix(id, matrix) {
                const element = document.getElementById(id);
                const size = matrix.length;
                element.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
                element.innerHTML = '';

                for (let i = 0; i < size; i++) {
                    for (let j = 0; j < size; j++) {
                        const cell = document.createElement('div');
                        cell.className = 'matrix-cell';
                        cell.textContent = matrix[i][j];
                        cell.dataset.row = i;
                        cell.dataset.col = j;

                        if ((id === 'matrixA' || id === 'matrixB') && 
                            document.getElementById('matrixMode').value === 'manual') {
                            cell.classList.add('editable');
                            cell.contentEditable = true;
                            cell.addEventListener('blur', (e) => {
                                const value = Math.max(0, Math.min(9, parseInt(e.target.textContent) || 0));
                                (id === 'matrixA' ? this.matrixA : this.matrixB)[i][j] = value;
                                e.target.textContent = value;
                            });
                            cell.addEventListener('keydown', (e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    e.target.blur();
                                }
                            });
                        }
                        element.appendChild(cell);
                    }
                }
            }

            enableMatrixEditing() {
                this.renderMatrix('matrixA', this.matrixA);
                this.renderMatrix('matrixB', this.matrixB);
            }

            disableMatrixEditing() {
                this.renderMatrix('matrixA', this.matrixA);
                this.renderMatrix('matrixB', this.matrixB);
            }

            async startSimulation() {
                if (this.isRunning) return;
                
                this.isRunning = true;
                document.getElementById('startBtn').disabled = true;
                document.getElementById('startBtn').textContent = '⏳ Running...';
                this.resetStats();
                
                const processCount = document.getElementById('processCountSelector').value;
                const matrixSize = document.getElementById('matrixSizeSelector').value;
                this.addLog(`Starting MPI simulation with ${processCount} processes`, 'info');
                this.addLog(`Matrix dimensions: ${matrixSize}×${matrixSize}`, 'info');
                this.addLog(`Animation speed: ${this.animationSpeed}x`, 'info');
                
                if (this.isStepMode) {
                    this.addLog('Step mode enabled - use Next Step button to proceed', 'info');
                    this.initializeStepMode();
                    
                    // Setup step mode UI
                    document.getElementById('startBtn').style.display = 'none';
                    const stepBtn = document.getElementById('stepBtn');
                    stepBtn.style.display = 'block';
                    stepBtn.disabled = false;
                    stepBtn.textContent = `➡️ Step 1/${this.stepQueue.length}`;
                    
                    // Initialize matrices for step mode
                    const size = parseInt(document.getElementById('matrixSizeSelector').value);
                    if (!this.matrixA || !this.matrixB) this.generateMatrices();
                    this.matrixC = this.createZeroMatrix(size);
                    this.renderMatrix('matrixC', this.matrixC);
                    
                    const rowsPerProcess = Math.ceil(size / this.processes.length);
                    this.colorCodeMatrixRows(size, this.processes.length, rowsPerProcess);
                    
                    return;
                }
                
                try {
                    await this.runMatrixMultiplication();
                    this.addLog('Matrix multiplication completed successfully', 'success');
                } catch (error) {
                    console.error('Simulation error:', error);
                    this.addLog(`Simulation error: ${error.message}`, 'error');
                } finally {
                    this.isRunning = false;
                    document.getElementById('startBtn').disabled = false;
                    document.getElementById('startBtn').textContent = '🚀 Start Simulation';
                }
            }

            async runMatrixMultiplication() {
                const size = parseInt(document.getElementById('matrixSizeSelector').value);
                const processCount = this.processes.length;
                
                if (!this.matrixA || !this.matrixB) this.generateMatrices();
                
                this.matrixC = this.createZeroMatrix(size);
                this.renderMatrix('matrixC', this.matrixC);
                
                const rowsPerProcess = Math.ceil(size / processCount);
                this.colorCodeMatrixRows(size, processCount, rowsPerProcess);
                
                // Phase 1: Scatter (Communication)
                this.addLog('Phase 1: Scattering matrix data to processes', 'info');
                this.updateProcessStatus(0, 'distributing', 'Sending rows to workers');
                await this.visualizeCommunication('scatter');
                
                // Phase 2: Parallel Computation
                this.addLog('Phase 2: Starting parallel computation', 'info');
                
                const computePromises = this.processes.map((process, i) => {
                    const startRow = i * rowsPerProcess;
                    const endRow = Math.min(startRow + rowsPerProcess, size);
                    
                    if (startRow >= size) return Promise.resolve(null);
                    
                    this.updateProcessStatus(i, 'computing', `Computing rows ${startRow}-${endRow-1}`);
                    return this.simulateProcessWork(i, startRow, endRow, size);
                }).filter(p => p);
                
                const workerResults = await Promise.all(computePromises);
                
                // Phase 3: Gather (Communication)
                this.addLog('Phase 3: Gathering results from processes', 'info');
                this.updateProcessStatus(0, 'gathering', 'Collecting computed results');
                await this.visualizeCommunication('gather');
                
                // Process results
                for (const result of workerResults) {
                    if (!result) continue;
                    
                    for (let i = 0; i < result.rows.length; i++) {
                        const globalRowIndex = result.startRow + i;
                        if (globalRowIndex < size) {
                            this.matrixC[globalRowIndex] = result.rows[i];
                            this.animateRowCompletion(globalRowIndex, result.processId);
                        }
                    }
                }
                
                // Phase 4: Finalize
                this.addLog('Phase 4: Finalizing computation results', 'success');
                this.renderMatrix('matrixC', this.matrixC);
                
                this.processes.forEach(p => this.updateProcessStatus(p.id, 'completed', 'Finished'));
            }

            async simulateProcessWork(processId, startRow, endRow, size) {
                const localResultRows = [];
                
                for (let i = startRow; i < endRow; i++) {
                    const newRow = new Array(size).fill(0);
                    
                    for (let j = 0; j < size; j++) {
                        // Highlight the cell being computed
                        this.highlightMatrixCell('matrixC', i, j, 'computing');
                        
                        // Highlight the corresponding row in matrix A and column in matrix B
                        this.highlightMatrixRow('matrixA', i, 'row-highlight');
                        this.highlightMatrixColumn('matrixB', j, 'col-highlight');
                        
                        // Perform matrix multiplication: C[i][j] = Σ(A[i][k] * B[k][j])
                        let cellValue = 0;
                        for (let k = 0; k < size; k++) {
                            // Highlight the specific cells being multiplied
                            this.highlightMatrixCell('matrixA', i, k, 'multiplying');
                            this.highlightMatrixCell('matrixB', k, j, 'multiplying');
                            
                            cellValue += this.matrixA[i][k] * this.matrixB[k][j];
                            
                            // Brief pause to show the multiplication
                            await this.delay(Math.random() * 30 + 15);
                            
                            // Clear the specific multiplication highlights
                            this.clearMatrixHighlights('multiplying');
                        }
                        newRow[j] = cellValue;
                        
                        // Clear all highlights and animate result
                        this.clearMatrixHighlights('computing');
                        this.clearMatrixHighlights('row-highlight');
                        this.clearMatrixHighlights('col-highlight');
                        this.animateCellCalculation(i, j, cellValue, processId);
                        
                        // Brief pause before next cell
                        await this.delay(Math.random() * 20 + 10);
                    }
                    localResultRows.push(newRow);
                }
                
                return { processId, startRow, rows: localResultRows };
            }

            async visualizeCommunication(type, duration = 1000) {
                const masterNode = this.processes[0].element;
                const workerNodes = this.processes.slice(1).map(p => p.element);

                if (type === 'scatter') {
                    masterNode.classList.add('sending');
                    workerNodes.forEach(node => node.classList.add('receiving'));
                } else if (type === 'gather') {
                    masterNode.classList.add('receiving');
                    workerNodes.forEach(node => node.classList.add('sending'));
                }
                
                await this.delay(duration);
                
                masterNode.classList.remove('sending', 'receiving');
                workerNodes.forEach(node => node.classList.remove('sending', 'receiving'));
            }

            colorCodeMatrixRows(size, processCount, rowsPerProcess) {
                for (let i = 0; i < size; i++) {
                    const processId = Math.floor(i / rowsPerProcess);
                    document.querySelectorAll(`#matrixC .matrix-cell[data-row="${i}"]`).forEach(cell => {
                        cell.classList.add(`process-${processId % 8}`);
                    });
                }
            }
            
            highlightMatrixCell(matrixId, row, col, className) {
                const cell = document.querySelector(`#${matrixId} .matrix-cell[data-row="${row}"][data-col="${col}"]`);
                if (cell) cell.classList.add(className);
            }

            highlightMatrixRow(matrixId, row, className) {
                document.querySelectorAll(`#${matrixId} .matrix-cell[data-row="${row}"]`).forEach(cell => {
                    cell.classList.add(className);
                });
            }

            highlightMatrixColumn(matrixId, col, className) {
                document.querySelectorAll(`#${matrixId} .matrix-cell[data-col="${col}"]`).forEach(cell => {
                    cell.classList.add(className);
                });
            }

            clearMatrixHighlights(className) {
                document.querySelectorAll(`.matrix-cell.${className}`).forEach(cell => cell.classList.remove(className));
            }

            animateCellCalculation(row, col, value, processId) {
                const cell = document.querySelector(`#matrixC .matrix-cell[data-row="${row}"][data-col="${col}"]`);
                if (cell) {
                    cell.textContent = value;
                    cell.style.animation = 'cellCalculation 0.5s ease-in-out';
                    setTimeout(() => { cell.style.animation = ''; }, 500);
                }
            }

            animateRowCompletion(row, processId) {
                document.querySelectorAll(`#matrixC .matrix-cell[data-row="${row}"]`).forEach((cell, index) => {
                    cell.classList.add(`process-${processId % 8}`);
                });
            }

            updateProcessStatus(processId, status, data) {
                if (processId >= this.processes.length) return;
                const p = this.processes[processId];
                p.status = status;
                p.data = data;
                p.element.querySelector('.process-status').textContent = status.charAt(0).toUpperCase() + status.slice(1);
                p.element.querySelector('.process-data').textContent = data || '';
                p.element.classList.remove('computing', 'sending', 'receiving');
                if (status === 'computing') p.element.classList.add('computing');
            }

            updateProcessCountOptions() {
                const matrixSize = parseInt(document.getElementById('matrixSizeSelector').value);
                const processCountSelector = document.getElementById('processCountSelector');
                const currentValue = processCountSelector.value;
                
                // Clear existing options
                processCountSelector.innerHTML = '';
                
                // Define valid process counts for each matrix size
                let validProcessCounts = [];
                switch(matrixSize) {
                    case 4:
                        validProcessCounts = [2, 4];
                        break;
                    case 6:
                        validProcessCounts = [2];
                        break;
                    case 8:
                        validProcessCounts = [2, 4, 8];
                        break;
                    case 16:
                        validProcessCounts = [2, 4, 8, 16];
                        break;
                    default:
                        validProcessCounts = [2, 4];
                }
                
                // Add new options
                validProcessCounts.forEach(count => {
                    const option = document.createElement('option');
                    option.value = count;
                    option.textContent = `${count} Processes`;
                    processCountSelector.appendChild(option);
                });
                
                // Try to maintain current selection if still valid, otherwise select first option
                if (validProcessCounts.includes(parseInt(currentValue))) {
                    processCountSelector.value = currentValue;
                } else {
                    processCountSelector.value = validProcessCounts[0];
                }
                
                // Reinitialize processes with new count
                this.initializeProcesses();
            }

            updateConfigDisplay() {
                const processCount = document.getElementById('processCountSelector').value;
                const matrixSize = document.getElementById('matrixSizeSelector').value;
                
                document.getElementById('displayProcessCount').textContent = processCount;
                document.getElementById('displayMatrixSize').textContent = `${matrixSize}×${matrixSize}`;
                
                this.currentMatrixSize = parseInt(matrixSize);
            }

            downloadMPICode() {
                const processCount = document.getElementById('processCountSelector').value;
                const matrixSize = document.getElementById('matrixSizeSelector').value;
                
                const mpiCode = this.generateMPICode(processCount, matrixSize);
                
                const blob = new Blob([mpiCode], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `matrix_multiplication_mpi_${processCount}proc_${matrixSize}x${matrixSize}.c`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }

            generateMPICode(processCount, matrixSize) {
                const rowsPerProcess = matrixSize / processCount;
                return `/*
==============================================================================
                    MPI PARALLEL MATRIX MULTIPLICATION
==============================================================================
Generated from Virtual Labs MPI Matrix Multiplication Experiment
Configuration: ${processCount} processes, ${matrixSize}×${matrixSize} matrices
Author: Virtual Labs - IIIT Hyderabad
Generated on: ${new Date().toISOString().split('T')[0]}

DESCRIPTION:
This program implements parallel matrix multiplication using MPI (Message 
Passing Interface) with row-wise decomposition strategy. The algorithm 
distributes rows of matrix A among processes while broadcasting matrix B 
to all processes.

ALGORITHM PHASES:
1. Data Distribution (Scatter): Master distributes row blocks to workers
2. Parallel Computation: Each process computes assigned rows independently  
3. Result Collection (Gather): Master collects partial results
4. Assembly: Master assembles the final result matrix

PERFORMANCE CHARACTERISTICS:
- Workload per process: ${rowsPerProcess} rows (${rowsPerProcess}×${matrixSize} elements)
- Total operations per process: ${rowsPerProcess * matrixSize * matrixSize} multiplications
- Communication pattern: Scatter-Broadcast-Gather
- Load balancing: Even distribution (${matrixSize} % ${processCount} = 0)

==============================================================================
                        HOW TO USE INPUT FILES
==============================================================================

STEP 1: CREATE INPUT FILES
Create two text files containing your ${matrixSize}×${matrixSize} matrices with space-separated values.

EXAMPLE: For ${matrixSize}×${matrixSize} matrices, create these files:

FILE: matrix_A.txt
${Array.from({ length: Math.min(4, matrixSize) }, (_, i) => 
    Array.from({ length: Math.min(4, matrixSize) }, (_, j) => 
        (i * matrixSize + j + 1).toFixed(1)
    ).join(' ')
).join('\n')}${matrixSize > 4 ? '\n... (continue for all ' + matrixSize + ' rows)' : ''}

FILE: matrix_B.txt
${Array.from({ length: Math.min(4, matrixSize) }, (_, i) => 
    Array.from({ length: Math.min(4, matrixSize) }, (_, j) => 
        (j === i ? 2.0 : (j === (i + 1) % matrixSize ? 1.0 : 0.0)).toFixed(1)
    ).join(' ')
).join('\n')}${matrixSize > 4 ? '\n... (continue for all ' + matrixSize + ' rows)' : ''}

STEP 2: PREPARE YOUR ENVIRONMENT
# Install MPI (choose one):
# Ubuntu/Debian: sudo apt-get install libopenmpi-dev openmpi-bin
# CentOS/RHEL: sudo yum install openmpi openmpi-devel
# macOS: brew install open-mpi
# Windows: Download Microsoft MPI or Intel MPI

STEP 3: COMPILE THE PROGRAM
mpicc -o matrix_mult matrix_multiplication_mpi_${processCount}proc_${matrixSize}x${matrixSize}.c -lm

STEP 4: RUN WITH YOUR INPUT FILES
# Method 1: With input files
mpirun -np ${processCount} ./matrix_mult matrix_A.txt matrix_B.txt

# Method 2: With random matrices (no input files)
mpirun -np ${processCount} ./matrix_mult

STEP 5: ADVANCED EXECUTION OPTIONS
# For better performance (CPU binding):
mpirun --bind-to core -np ${processCount} ./matrix_mult matrix_A.txt matrix_B.txt

# For debugging with Valgrind:
mpirun -np ${processCount} valgrind --tool=memcheck ./matrix_mult

# For profiling:
mpirun -np ${processCount} gprof ./matrix_mult gmon.out

# On clusters with hostfile:
mpirun -np ${processCount} --hostfile hosts.txt ./matrix_mult matrix_A.txt matrix_B.txt

CREATING CUSTOM INPUT FILES:
The program expects exactly ${matrixSize * matrixSize} numbers per file, arranged in ${matrixSize} rows
and ${matrixSize} columns. You can use any floating-point numbers. Examples:

SIMPLE IDENTITY-LIKE MATRIX (matrix_A.txt):
1.0 0.0 0.0 0.0 ...
0.0 1.0 0.0 0.0 ...
0.0 0.0 1.0 0.0 ...
0.0 0.0 0.0 1.0 ...
... (continue pattern)

INCREMENTAL MATRIX (matrix_B.txt):
1.0 2.0 3.0 4.0 ...
5.0 6.0 7.0 8.0 ...
9.0 10.0 11.0 12.0 ...
13.0 14.0 15.0 16.0 ...
... (continue sequence)

PYTHON SCRIPT TO GENERATE RANDOM INPUT FILES:
#!/usr/bin/env python3
import random
import sys

def generate_matrix_file(filename, size):
    with open(filename, 'w') as f:
        for i in range(size):
            row = [str(round(random.uniform(0, 10), 2)) for _ in range(size)]
            f.write(' '.join(row) + '\\n')
    print(f"Generated {filename} with {size}x{size} random matrix")

if __name__ == "__main__":
    size = ${matrixSize}
    generate_matrix_file("matrix_A.txt", size)
    generate_matrix_file("matrix_B.txt", size)
    print(f"Run with: mpirun -np ${processCount} ./matrix_mult matrix_A.txt matrix_B.txt")

MATLAB/OCTAVE SCRIPT TO GENERATE INPUT FILES:
% Generate ${matrixSize}x${matrixSize} matrices
A = rand(${matrixSize}, ${matrixSize}) * 10;
B = rand(${matrixSize}, ${matrixSize}) * 10;

% Save to files (space-separated format)
dlmwrite('matrix_A.txt', A, ' ');
dlmwrite('matrix_B.txt', B, ' ');

fprintf('Generated input files for ${matrixSize}x${matrixSize} matrices\\n');
fprintf('Run with: mpirun -np ${processCount} ./matrix_mult matrix_A.txt matrix_B.txt\\n');

TROUBLESHOOTING COMMON INPUT ISSUES:
1. "Error reading from file" - Check file format, ensure space-separated values
2. "File not found" - Verify file paths and permissions
3. "Wrong matrix dimensions" - Ensure exactly ${matrixSize}x${matrixSize} values per file
4. "Invalid numbers" - Remove any non-numeric characters, use decimal points not commas

FILE FORMAT VALIDATION:
To verify your input files are correctly formatted:
# Count numbers in file (should be ${matrixSize * matrixSize}):
wc -w matrix_A.txt matrix_B.txt

# Check first few lines:
head -5 matrix_A.txt
head -5 matrix_B.txt

# Validate with a simple test (on small matrices):
mpirun -np 1 ./matrix_mult matrix_A.txt matrix_B.txt

==============================================================================
*/

#include <mpi.h>
#include <stdio.h> 
#include <stdlib.h>
#include <math.h>
#include <time.h>
#include <sys/time.h>
#include <unistd.h>

// Matrix configuration
#define N ${matrixSize}                    // Matrix dimension (N×N)
#define NUM_PROCESSES ${processCount}      // Number of MPI processes
#define ROWS_PER_PROCESS (N/NUM_PROCESSES) // Rows assigned to each process

// Compile-time validation to ensure even row distribution
#if (N % NUM_PROCESSES) != 0
    #error "Matrix size N must be evenly divisible by NUM_PROCESSES for this implementation"
#endif

// Function prototypes
void initialize_matrix_random(double matrix[N][N], int seed_offset);
void initialize_matrix_from_file(double matrix[N][N], const char* filename);
void print_matrix(double matrix[N][N], const char* name, int show_full);
void print_matrix_partial(double local_matrix[][N], int rows, int process_rank, const char* name);
double get_time();
void validate_result(double A[N][N], double B[N][N], double C[N][N]);

int main(int argc, char** argv) {
    // MPI variables
    int rank, size;
    double start_time, end_time, compute_time, comm_time;
    
    // Matrix storage - Optimized memory allocation
    // A and C are only allocated on the root process (rank 0) to save memory
    double (*A)[N] = NULL, (*B)[N] = NULL, (*C)[N] = NULL;
    double local_A[ROWS_PER_PROCESS][N];                  // Local portion of A
    double local_C[ROWS_PER_PROCESS][N];                  // Local portion of result
    
    // Initialize MPI environment
    MPI_Init(&argc, &argv);
    MPI_Comm_rank(MPI_COMM_WORLD, &rank);
    MPI_Comm_size(MPI_COMM_WORLD, &size);
    
    // Validate process count
    if (size != NUM_PROCESSES) {
        if (rank == 0) {
            printf("ERROR: This program requires exactly %d processes.\\n", NUM_PROCESSES);
            printf("Usage: mpirun -np %d ./matrix_mult [input_file_A] [input_file_B]\\n", NUM_PROCESSES);
        }
        MPI_Finalize();
        return 1;
    }
    
    // Allocate memory for matrices efficiently
    if (rank == 0) {
        A = malloc(sizeof(double[N][N]));
        C = malloc(sizeof(double[N][N]));
        if (!A || !C) {
            printf("ERROR: Memory allocation failed on master process\\n");
            MPI_Abort(MPI_COMM_WORLD, 1);
        }
    }
    // Matrix B is needed by all processes for computation
    B = malloc(sizeof(double[N][N]));
    if (!B) {
        printf("ERROR: Memory allocation failed for matrix B on process %d\\n", rank);
        MPI_Abort(MPI_COMM_WORLD, 1);
    }

    start_time = get_time();
    
    // ==================================================================
    // PHASE 1: DATA INITIALIZATION AND DISTRIBUTION (SCATTER)
    // ==================================================================
    
    if (rank == 0) {
        printf("\\n" "="*60 "\\n");
        printf("    MPI PARALLEL MATRIX MULTIPLICATION\\n");
        printf("="*60 "\\n");
        printf("Configuration:\\n");
        printf("  Matrix size: %dx%d\\n", N, N);
        printf("  Processes: %d\\n", NUM_PROCESSES);
        printf("  Rows per process: %d\\n", ROWS_PER_PROCESS);
        printf("\\nPhase 1: Initializing and distributing data...\\n");
        
        // Initialize matrices
        if (argc >= 3) {
            // Load from files if provided
            printf("Loading Matrix A from: %s\\n", argv[1]);
            printf("Loading Matrix B from: %s\\n", argv[2]);
            initialize_matrix_from_file(A, argv[1]);
            initialize_matrix_from_file(B, argv[2]);
        } else {
            // Generate random matrices
            printf("Generating random matrices...\\n");
            initialize_matrix_random(A, 0);
            initialize_matrix_random(B, 1);
        }
        
        // Display matrices (partial for large sizes)
        print_matrix(A, "Matrix A", N <= 16);
        print_matrix(B, "Matrix B", N <= 16);
    }
    
    // *** EFFICIENT DATA DISTRIBUTION USING MPI_SCATTER ***
    // Scatter the rows of matrix A from root process to all processes
    // This is more efficient than manual Send/Recv loops
    printf("Process %d: Waiting to receive rows of A via MPI_Scatter...\\n", rank);
    MPI_Scatter(
        (rank == 0) ? A : NULL,     // Send buffer (only valid on root, NULL on others)
        ROWS_PER_PROCESS * N,       // Number of elements to send to each process
        MPI_DOUBLE,                 // Data type of send buffer elements
        local_A,                    // Receive buffer (local_A on each process)
        ROWS_PER_PROCESS * N,       // Number of elements to receive
        MPI_DOUBLE,                 // Data type of receive buffer elements
        0,                          // Rank of the sending (root) process
        MPI_COMM_WORLD              // Communicator
    );
    printf("Process %d: Received rows %d-%d\\n", rank, 
           rank * ROWS_PER_PROCESS, (rank + 1) * ROWS_PER_PROCESS - 1);
    
    // Broadcast matrix B to all processes
    printf("Process %d: Receiving matrix B via broadcast...\\n", rank);
    MPI_Bcast(B, N * N, MPI_DOUBLE, 0, MPI_COMM_WORLD);
    
    comm_time = get_time() - start_time;
    
    // ==================================================================
    // PHASE 2: PARALLEL COMPUTATION
    // ==================================================================
    
    if (rank == 0) {
        printf("\\nPhase 2: Starting parallel computation...\\n");
    }
    
    double compute_start = get_time();
    
    // Each process computes its assigned rows
    printf("Process %d: Computing local matrix multiplication...\\n", rank);
    
    for (int i = 0; i < ROWS_PER_PROCESS; i++) {
        for (int j = 0; j < N; j++) {
            local_C[i][j] = 0.0;
            
            // Perform dot product: C[i][j] = sum(A[i][k] * B[k][j])
            for (int k = 0; k < N; k++) {
                local_C[i][j] += local_A[i][k] * B[k][j];
            }
        }
    }
    
    compute_time = get_time() - compute_start;
    printf("Process %d: Computation completed in %.4f seconds\\n", rank, compute_time);
    
    // Optional: Display local results for verification (small matrices only)
    if (N <= 8) {
        print_matrix_partial(local_C, ROWS_PER_PROCESS, rank, "Local Result");
    }
    
    // ==================================================================
    // PHASE 3: RESULT COLLECTION (GATHER)
    // ==================================================================
    
    if (rank == 0) {
        printf("\\nPhase 3: Collecting results...\\n");
    }
    
    // *** EFFICIENT RESULT COLLECTION USING MPI_GATHER ***
    // Gather the computed local results from all processes back to root
    // This is more efficient than manual Send/Recv loops
    printf("Process %d: Sending local results to master via MPI_Gather...\\n", rank);
    MPI_Gather(
        local_C,                    // Send buffer (local result on each process)
        ROWS_PER_PROCESS * N,       // Number of elements to send
        MPI_DOUBLE,                 // Data type of send buffer elements
        (rank == 0) ? C : NULL,     // Receive buffer (only valid on root, NULL on others)
        ROWS_PER_PROCESS * N,       // Number of elements to receive from each process
        MPI_DOUBLE,                 // Data type of receive buffer elements
        0,                          // Rank of the receiving (root) process
        MPI_COMM_WORLD              // Communicator
    );
    
    end_time = get_time();
    
    // ==================================================================
    // PHASE 4: RESULTS AND PERFORMANCE ANALYSIS
    // ==================================================================
    
    if (rank == 0) {
        printf("\\nPhase 4: Finalizing results...\\n");
        
        // Display result matrix
        print_matrix(C, "Result Matrix C = A × B", N <= 16);
        
        // Performance analysis
        double total_time = end_time - start_time;
        printf("\\n" "="*60 "\\n");
        printf("           PERFORMANCE ANALYSIS\\n");
        printf("="*60 "\\n");
        printf("Total execution time:     %.6f seconds\\n", total_time);
        printf("Communication time:       %.6f seconds (%.1f%%)\\n", 
               comm_time, (comm_time/total_time)*100);
        printf("Computation time:         %.6f seconds (%.1f%%)\\n", 
               compute_time, (compute_time/total_time)*100);
        printf("\\nWorkload distribution:\\n");
        printf("  Operations per process: %d multiplications\\n", 
               ROWS_PER_PROCESS * N * N);
        printf("  Total operations:       %d multiplications\\n", N * N * N);
        printf("  Theoretical speedup:    %.2fx (with %d processes)\\n", 
               (double)NUM_PROCESSES, NUM_PROCESSES);
        
        // Optional: Validate result for small matrices
        if (N <= 8) {
            printf("\\nValidating result...\\n");
            validate_result(A, B, C);
        }
        
        printf("\\nMatrix multiplication completed successfully!\\n");
        printf("="*60 "\\n");
    }
    
    // Clean up allocated memory
    if (rank == 0) {
        free(A);
        free(C);
    }
    free(B);
    
    MPI_Finalize();
    return 0;
}

// ==================================================================
// UTILITY FUNCTIONS
// ==================================================================

void initialize_matrix_random(double matrix[N][N], int seed_offset) {
    srand(time(NULL) + getpid() + seed_offset);
    for (int i = 0; i < N; i++) {
        for (int j = 0; j < N; j++) {
            matrix[i][j] = (double)(rand() % 10);  // Values 0-9
        }
    }
}

void initialize_matrix_from_file(double matrix[N][N], const char* filename) {
    /*
    INPUT FILE FORMAT REQUIREMENTS:
    - File must contain exactly ${matrixSize}x${matrixSize} = ${matrixSize * matrixSize} floating-point numbers
    - Numbers should be space-separated (spaces, tabs, or newlines as delimiters)
    - Each row should contain ${matrixSize} numbers
    - File should have ${matrixSize} rows total
    - Numbers can be integers or decimals (e.g., 1.0, 2.5, -3.14)
    
    EXAMPLE ${matrixSize}x${matrixSize} INPUT FILE:
    1.0 2.0 3.0 4.0${matrixSize > 4 ? ' ...' : ''}
    5.0 6.0 7.0 8.0${matrixSize > 4 ? ' ...' : ''}
    9.0 10.0 11.0 12.0${matrixSize > 4 ? ' ...' : ''}
    13.0 14.0 15.0 16.0${matrixSize > 4 ? ' ...' : ''}${matrixSize > 4 ? '\n    ... (continue for all ' + matrixSize + ' rows)' : ''}
    
    CREATING INPUT FILES WITH DIFFERENT TOOLS:
    
    1. MANUAL CREATION (text editor):
       - Open any text editor (notepad, vim, nano, etc.)
       - Enter numbers row by row, space-separated
       - Save as .txt file
    
    2. SPREADSHEET EXPORT (Excel, LibreOffice Calc):
       - Create ${matrixSize}x${matrixSize} matrix in spreadsheet
       - File → Export → Text (CSV) → Change delimiter to space
       - Remove any quotes if present
    
    3. PROGRAMMING LANGUAGES:
       Python: numpy.savetxt('matrix.txt', matrix, delimiter=' ')
       MATLAB: dlmwrite('matrix.txt', matrix, ' ')
       C++: Use nested loops with ofstream
    
    FILE VALIDATION COMMANDS:
    wc -w filename.txt     # Should output ${matrixSize * matrixSize}
    wc -l filename.txt     # Should output ${matrixSize}
    head filename.txt      # Check first few rows
    */
    
    FILE* file = fopen(filename, "r");
    if (file == NULL) {
        printf("Warning: Could not open %s, using random values instead\\n", filename);
        printf("Make sure the file exists and has read permissions\\n");
        printf("Expected format: ${matrixSize}x${matrixSize} matrix with space-separated values\\n");
        printf("For production use, consider using MPI_Abort() for fatal file errors\\n");
        initialize_matrix_random(matrix, 0);
        return;
    }
    
    printf("Reading matrix from %s...\\n", filename);
    int elements_read = 0;
    
    for (int i = 0; i < N; i++) {
        for (int j = 0; j < N; j++) {
            if (fscanf(file, "%lf", &matrix[i][j]) != 1) {
                printf("Warning: Error reading element [%d][%d] from %s\\n", i, j, filename);
                printf("Expected %d total elements, successfully read %d\\n", N*N, elements_read);
                printf("Check file format: ensure %dx%d space-separated numbers\\n", N, N);
                fclose(file);
                initialize_matrix_random(matrix, 0);
                return;
            }
            elements_read++;
        }
    }
    fclose(file);
    printf("Successfully loaded %dx%d matrix from %s (%d elements)\\n", N, N, filename, elements_read);
}

void print_matrix(double matrix[N][N], const char* name, int show_full) {
    printf("\\n%s:\\n", name);
    
    if (show_full) {
        // Show complete matrix for small sizes
        for (int i = 0; i < N; i++) {
            printf("  ");
            for (int j = 0; j < N; j++) {
                printf("%8.2f ", matrix[i][j]);
            }
            printf("\\n");
        }
    } else {
        // Show partial matrix for large sizes
        printf("  [Matrix too large to display completely - showing corners]\\n");
        printf("  Top-left 3x3:\\n");
        for (int i = 0; i < 3 && i < N; i++) {
            printf("    ");
            for (int j = 0; j < 3 && j < N; j++) {
                printf("%8.2f ", matrix[i][j]);
            }
            printf("\\n");
        }
        printf("  ... (remaining %dx%d elements)\\n", N, N);
    }
}

void print_matrix_partial(double local_matrix[][N], int rows, int process_rank, const char* name) {
    printf("\\nProcess %d - %s (rows %d-%d):\\n", 
           process_rank, name, process_rank * rows, (process_rank + 1) * rows - 1);
    
    for (int i = 0; i < rows; i++) {
        printf("  ");
        for (int j = 0; j < N; j++) {
            printf("%8.2f ", local_matrix[i][j]);
        }
        printf("\\n");
    }
}

double get_time() {
    struct timeval tv;
    gettimeofday(&tv, NULL);
    return tv.tv_sec + tv.tv_usec / 1000000.0;
}

void validate_result(double A[N][N], double B[N][N], double C[N][N]) {
    printf("Performing sequential validation...\\n");
    double expected[N][N];
    
    // Compute expected result sequentially
    for (int i = 0; i < N; i++) {
        for (int j = 0; j < N; j++) {
            expected[i][j] = 0.0;
            for (int k = 0; k < N; k++) {
                expected[i][j] += A[i][k] * B[k][j];
            }
        }
    }
    
    // Compare results
    int errors = 0;
    for (int i = 0; i < N; i++) {
        for (int j = 0; j < N; j++) {
            if (fabs(C[i][j] - expected[i][j]) > 1e-10) {
                printf("Error at C[%d][%d]: got %.6f, expected %.6f\\n", 
                       i, j, C[i][j], expected[i][j]);
                errors++;
            }
        }
    }
    
    if (errors == 0) {
        printf("✓ Validation successful: All results match sequential computation\\n");
    } else {
        printf("✗ Validation failed: %d errors found\\n", errors);
    }
}

/*
==============================================================================
                         COMPILATION AND EXECUTION GUIDE
==============================================================================

COMPLETE SETUP INSTRUCTIONS:

PREREQUISITES:
1. MPI Implementation: Install one of the following:
   - OpenMPI (recommended for Linux/macOS)
   - MPICH (good alternative)
   - Intel MPI (for Intel systems)
   - Microsoft MPI (for Windows)

2. C Compiler with MPI support:
   - mpicc (wrapper for gcc/clang with MPI)
   - Ensure it's in your PATH

INSTALLATION BY PLATFORM:

Ubuntu/Debian:
  sudo apt-get update
  sudo apt-get install libopenmpi-dev openmpi-bin

CentOS/RHEL/Fedora:
  sudo yum install openmpi openmpi-devel
  # or for newer versions:
  sudo dnf install openmpi openmpi-devel

macOS (with Homebrew):
  brew install open-mpi

Windows:
  1. Download Microsoft MPI from Microsoft website
  2. Install both msmpisetup.exe and msmpisdk.msi
  3. Use Visual Studio with MPI support or WSL

COMPILATION:
  mpicc -o matrix_mult matrix_multiplication_mpi_${processCount}proc_${matrixSize}x${matrixSize}.c -lm

EXECUTION OPTIONS:

1. With random matrices (no input files needed):
   mpirun -np ${processCount} ./matrix_mult

2. With your custom input files:
   mpirun -np ${processCount} ./matrix_mult matrix_A.txt matrix_B.txt

3. Advanced execution with performance optimization:
   mpirun --bind-to core -np ${processCount} ./matrix_mult matrix_A.txt matrix_B.txt

4. For debugging:
   mpirun -np ${processCount} valgrind --tool=memcheck ./matrix_mult

5. For profiling:
   mpirun -np ${processCount} gprof ./matrix_mult

6. On compute clusters:
   mpirun -np ${processCount} --hostfile hosts.txt ./matrix_mult matrix_A.txt matrix_B.txt

EXPECTED OUTPUT FORMAT:
=============================================================
    MPI PARALLEL MATRIX MULTIPLICATION
=============================================================
Configuration:
  Matrix size: ${matrixSize}x${matrixSize}
  Processes: ${processCount}
  Rows per process: ${rowsPerProcess}

Phase 1: Initializing and distributing data...
Loading Matrix A from: matrix_A.txt (or "Generating random matrices...")
Loading Matrix B from: matrix_B.txt

Matrix A:
    1.00     2.00     3.00 ...
    4.00     5.00     6.00 ...
    ...

Distributing matrix A rows to processes...
  Sending rows ${rowsPerProcess}-${rowsPerProcess * 2 - 1} to process 1
  Sending rows ${rowsPerProcess * 2}-${rowsPerProcess * 3 - 1} to process 2
  ...

Phase 2: Starting parallel computation...
Process 0: Computing local matrix multiplication...
Process 1: Computing local matrix multiplication...
...

Phase 3: Collecting results...
  Collecting rows ${rowsPerProcess}-${rowsPerProcess * 2 - 1} from process 1
  ...

Result Matrix C = A × B:
   10.00    20.00    30.00 ...
   40.00    50.00    60.00 ...
   ...

=============================================================
           PERFORMANCE ANALYSIS
=============================================================
Total execution time:     0.001234 seconds
Communication time:       0.000123 seconds (10.0%)
Computation time:         0.001000 seconds (81.1%)

Workload distribution:
  Operations per process: ${rowsPerProcess * matrixSize * matrixSize} multiplications
  Total operations:       ${matrixSize * matrixSize * matrixSize} multiplications
  Theoretical speedup:    ${processCount}.00x (with ${processCount} processes)

Matrix multiplication completed successfully!
=============================================================

PERFORMANCE OPTIMIZATION TIPS:
1. Use CPU binding for better cache locality:
   mpirun --bind-to core -np ${processCount} ./matrix_mult

2. Set optimal thread count (if using hybrid MPI+OpenMP):
   export OMP_NUM_THREADS=1
   mpirun -np ${processCount} ./matrix_mult

3. For large matrices, consider file I/O optimization:
   # Use local storage instead of network drives
   # Pre-stage input files on compute nodes

4. Monitor system resources:
   htop  # Check CPU and memory usage during execution
   iostat -x 1  # Monitor I/O performance

COMMON TROUBLESHOOTING:

Error: "mpicc: command not found"
Solution: Install MPI development packages or add MPI to PATH

Error: "This program requires exactly ${processCount} processes"
Solution: Use exactly -np ${processCount} in mpirun command

Error: "Could not open matrix_A.txt"
Solution: Ensure files exist in current directory and have read permissions

Error: "Segmentation fault"
Solution: Check matrix dimensions, compile with -g flag for debugging

Error: "Permission denied: ./matrix_mult"
Solution: Make executable with: chmod +x matrix_mult

VERIFICATION AND TESTING:
1. Test with small matrices first (4x4 or 8x8)
2. Compare results with sequential computation
3. Use built-in validation for matrices ≤ 8x8
4. Monitor memory usage for large matrices

==============================================================================
                      COMPLETE INPUT FILE EXAMPLES
==============================================================================

EXAMPLE 1: IDENTITY-LIKE MATRIX (matrix_A.txt for ${matrixSize}x${matrixSize}):
${Array.from({ length: matrixSize }, (_, i) => 
    Array.from({ length: matrixSize }, (_, j) => 
        (i === j ? '2.0' : (Math.abs(i - j) === 1 ? '1.0' : '0.0'))
    ).join(' ')
).slice(0, 3).join('\n')}${matrixSize > 3 ? '\n... (pattern continues for all ' + matrixSize + ' rows)' : ''}

EXAMPLE 2: INCREMENTAL MATRIX (matrix_B.txt for ${matrixSize}x${matrixSize}):
${Array.from({ length: matrixSize }, (_, i) => 
    Array.from({ length: matrixSize }, (_, j) => 
        (i * matrixSize + j + 1).toFixed(1)
    ).join(' ')
).slice(0, 3).join('\n')}${matrixSize > 3 ? '\n... (sequence continues to ' + (matrixSize * matrixSize) + ')' : ''}

UTILITY SCRIPTS TO GENERATE INPUT FILES:

BASH SCRIPT (generate_matrices.sh):
#!/bin/bash
echo "Generating ${matrixSize}x${matrixSize} matrices..."

# Generate matrix A (random values 0-10)
for i in \$(seq 1 ${matrixSize}); do
    for j in \$(seq 1 ${matrixSize}); do
        printf "%.1f " \$(echo "scale=1; \$RANDOM % 100 / 10" | bc)
    done
    echo
done > matrix_A.txt

# Generate matrix B (different random values)
for i in \$(seq 1 ${matrixSize}); do
    for j in \$(seq 1 ${matrixSize}); do
        printf "%.1f " \$(echo "scale=1; \$RANDOM % 100 / 10" | bc)
    done
    echo
done > matrix_B.txt

echo "Generated matrix_A.txt and matrix_B.txt"
echo "Run with: mpirun -np ${processCount} ./matrix_mult matrix_A.txt matrix_B.txt"

PYTHON SCRIPT (generate_matrices.py):
#!/usr/bin/env python3
import random
import numpy as np

def create_test_matrices():
    size = ${matrixSize}
    
    # Method 1: Random matrices
    A = np.random.uniform(0, 10, (size, size))
    B = np.random.uniform(0, 10, (size, size))
    
    # Method 2: Structured matrices (uncomment to use)
    # A = np.arange(1, size*size + 1).reshape(size, size)
    # B = np.eye(size) * 2 + np.ones((size, size))
    
    # Save with space separation
    np.savetxt('matrix_A.txt', A, fmt='%.2f', delimiter=' ')
    np.savetxt('matrix_B.txt', B, fmt='%.2f', delimiter=' ')
    
    print(f"Generated {size}x{size} matrices:")
    print("- matrix_A.txt: Random values 0-10")
    print("- matrix_B.txt: Random values 0-10")
    print(f"Run with: mpirun -np ${processCount} ./matrix_mult matrix_A.txt matrix_B.txt")
    
    # Verify file format
    print("\\nFile verification:")
    print(f"A elements: {A.size}, B elements: {B.size}")
    print(f"Expected: {size*size} elements each")

if __name__ == "__main__":
    create_test_matrices()

MATLAB/OCTAVE SCRIPT (generate_matrices.m):
% Generate ${matrixSize}x${matrixSize} test matrices
function generate_matrices()
    size = ${matrixSize};
    
    % Method 1: Random matrices
    A = rand(size, size) * 10;  % Random values 0-10
    B = rand(size, size) * 10;
    
    % Method 2: Structured matrices (uncomment to use)
    % A = reshape(1:size^2, size, size);
    % B = eye(size) * 2 + ones(size, size);
    
    % Save matrices (space-separated format)
    dlmwrite('matrix_A.txt', A, ' ');
    dlmwrite('matrix_B.txt', B, ' ');
    
    fprintf('Generated %dx%d matrices:\\n', size, size);
    fprintf('- matrix_A.txt: Random values 0-10\\n');
    fprintf('- matrix_B.txt: Random values 0-10\\n');
    fprintf('Run with: mpirun -np ${processCount} ./matrix_mult matrix_A.txt matrix_B.txt\\n');
    
    % Verify dimensions
    fprintf('\\nVerification:\\n');
    fprintf('Matrix A: %dx%d (%d elements)\\n', size, size, numel(A));
    fprintf('Matrix B: %dx%d (%d elements)\\n', size, size, numel(B));
end

C++ PROGRAM (generate_matrices.cpp):
#include <iostream>
#include <fstream>
#include <random>
#include <iomanip>

int main() {
    const int N = ${matrixSize};
    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_real_distribution<double> dist(0.0, 10.0);
    
    // Generate matrix A
    std::ofstream fileA("matrix_A.txt");
    for (int i = 0; i < N; i++) {
        for (int j = 0; j < N; j++) {
            fileA << std::fixed << std::setprecision(2) << dist(gen);
            if (j < N-1) fileA << " ";
        }
        fileA << "\\n";
    }
    fileA.close();
    
    // Generate matrix B
    std::ofstream fileB("matrix_B.txt");
    for (int i = 0; i < N; i++) {
        for (int j = 0; j < N; j++) {
            fileB << std::fixed << std::setprecision(2) << dist(gen);
            if (j < N-1) fileB << " ";
        }
        fileB << "\\n";
    }
    fileB.close();
    
    std::cout << "Generated " << N << "x" << N << " matrices:\\n";
    std::cout << "- matrix_A.txt: Random values 0-10\\n";
    std::cout << "- matrix_B.txt: Random values 0-10\\n";
    std::cout << "Compile: g++ -o generate_matrices generate_matrices.cpp\\n";
    std::cout << "Run MPI: mpirun -np ${processCount} ./matrix_mult matrix_A.txt matrix_B.txt\\n";
    
    return 0;
}

FILE FORMAT VALIDATION COMMANDS:
# Check file format and dimensions
wc -w matrix_A.txt matrix_B.txt  # Should show ${matrixSize * matrixSize} for each
wc -l matrix_A.txt matrix_B.txt  # Should show ${matrixSize} for each
head -3 matrix_A.txt             # Check first 3 rows
tail -3 matrix_A.txt             # Check last 3 rows

# Quick visual inspection
echo "Matrix A (first 3 rows):" && head -3 matrix_A.txt
echo "Matrix B (first 3 rows):" && head -3 matrix_B.txt

# Verify numbers are valid
awk 'NF != ${matrixSize} { print "Row " NR " has " NF " columns (expected ${matrixSize})" }' matrix_A.txt

COMMON FILE FORMAT ISSUES AND SOLUTIONS:

Issue: "Error reading element [i][j]"
Solution: Check that each row has exactly ${matrixSize} numbers separated by spaces

Issue: File has ${matrixSize * matrixSize + 1} elements
Solution: Remove any trailing newlines or extra spaces at end of file

Issue: Numbers contain commas (1,5 instead of 1.5)
Solution: Use period (.) as decimal separator, not comma

Issue: Scientific notation (1.5e+2)
Solution: MPI program accepts this format, but regular decimals are clearer

Issue: File encoding problems
Solution: Save files as plain text (UTF-8 or ASCII), not Word documents

TESTING YOUR INPUT FILES:
1. Create small test matrices (2x2 or 3x3) first
2. Manually verify results with calculator
3. Use single process first: mpirun -np 1 ./matrix_mult matrix_A.txt matrix_B.txt
4. Compare with online matrix calculators
5. Gradually increase matrix size and process count

==============================================================================
*/`;
            }

            resetStats() {
                this.updateConfigDisplay();
                this.processes.forEach(p => this.updateProcessStatus(p.id, 'idle', ''));
                this.clearLogs();
                this.addLog('System reset and ready for simulation', 'info');
                
                // Reset step mode
                this.currentStep = 0;
                this.stepQueue = [];
                
                const stepBtn = document.getElementById('stepBtn');
                stepBtn.textContent = '➡️ Next Step';
                stepBtn.disabled = false;
                
                // Clear any existing highlights
                this.clearMatrixHighlights('computing');
                this.clearMatrixHighlights('row-highlight');
                this.clearMatrixHighlights('col-highlight');
                this.clearMatrixHighlights('multiplying');
            }

            addLog(message, type = 'info') {
                const logsContainer = document.getElementById('logsContainer');
                if (!logsContainer) return;

                const now = new Date();
                const timeStr = now.toTimeString().split(' ')[0];
                
                const logEntry = document.createElement('div');
                logEntry.className = `log-entry ${type}`;
                logEntry.innerHTML = `
                    <span class="log-time">${timeStr}</span>
                    <span class="log-message">${message}</span>
                `;
                
                logsContainer.appendChild(logEntry);
                logsContainer.scrollTop = logsContainer.scrollHeight;
            }

            clearLogs() {
                const logsContainer = document.getElementById('logsContainer');
                if (logsContainer) {
                    logsContainer.innerHTML = `
                        <div class="log-entry">
                            <span class="log-time">00:00:00</span>
                            <span class="log-message">System initialized and ready</span>
                        </div>
                    `;
                }
            }

            delay(ms) { 
                return new Promise(resolve => setTimeout(resolve, ms / this.animationSpeed)); 
            }

            // Step mode functionality
            initializeStepMode() {
                this.stepQueue = [];
                this.currentStep = 0;
                
                const size = parseInt(document.getElementById('matrixSizeSelector').value);
                const processCount = this.processes.length;
                const rowsPerProcess = Math.ceil(size / processCount);
                
                // Build step queue
                this.stepQueue.push({ type: 'scatter', description: 'Scatter matrix data to processes' });
                
                for (let processId = 0; processId < processCount; processId++) {
                    const startRow = processId * rowsPerProcess;
                    const endRow = Math.min(startRow + rowsPerProcess, size);
                    
                    if (startRow >= size) continue;
                    
                    for (let i = startRow; i < endRow; i++) {
                        for (let j = 0; j < size; j++) {
                            this.stepQueue.push({
                                type: 'compute',
                                processId,
                                row: i,
                                col: j,
                                description: `Process ${processId}: Computing C[${i}][${j}]`
                            });
                        }
                    }
                }
                
                this.stepQueue.push({ type: 'gather', description: 'Gather results from processes' });
                this.stepQueue.push({ type: 'finalize', description: 'Simulation completed' });
            }

            async executeNextStep() {
                if (this.currentStep >= this.stepQueue.length) {
                    this.completeStepModeSimulation();
                    return;
                }
                
                const step = this.stepQueue[this.currentStep];
                this.addLog(`Step ${this.currentStep + 1}/${this.stepQueue.length}: ${step.description}`, 'info');
                
                switch (step.type) {
                    case 'scatter':
                        await this.visualizeCommunication('scatter', 1000);
                        break;
                        
                    case 'compute':
                        await this.executeComputeStep(step);
                        break;
                        
                    case 'gather':
                        await this.visualizeCommunication('gather', 1000);
                        break;
                        
                    case 'finalize':
                        this.addLog('Matrix multiplication completed successfully', 'success');
                        break;
                }
                
                this.currentStep++;
                
                // Update step button text
                const stepBtn = document.getElementById('stepBtn');
                if (this.currentStep >= this.stepQueue.length) {
                    stepBtn.textContent = '✅ Complete';
                    stepBtn.disabled = true;
                } else {
                    stepBtn.textContent = `➡️ Step ${this.currentStep + 1}/${this.stepQueue.length}`;
                }
            }

            async executeComputeStep(step) {
                const { processId, row, col } = step;
                const size = parseInt(document.getElementById('matrixSizeSelector').value);
                
                // Update process status
                this.updateProcessStatus(processId, 'computing', `Computing C[${row}][${col}]`);
                
                // Highlight the cell being computed
                this.highlightMatrixCell('matrixC', row, col, 'computing');
                this.highlightMatrixRow('matrixA', row, 'row-highlight');
                this.highlightMatrixColumn('matrixB', col, 'col-highlight');
                
                // Compute the cell value
                let cellValue = 0;
                for (let k = 0; k < size; k++) {
                    this.highlightMatrixCell('matrixA', row, k, 'multiplying');
                    this.highlightMatrixCell('matrixB', k, col, 'multiplying');
                    
                    cellValue += this.matrixA[row][k] * this.matrixB[k][col];
                    
                    await this.delay(100);
                    this.clearMatrixHighlights('multiplying');
                }
                
                // Update the result matrix
                this.matrixC[row][col] = cellValue;
                this.animateCellCalculation(row, col, cellValue, processId);
                
                // Clear highlights
                this.clearMatrixHighlights('computing');
                this.clearMatrixHighlights('row-highlight');
                this.clearMatrixHighlights('col-highlight');
                
                await this.delay(200);
            }

            completeStepModeSimulation() {
                this.isRunning = false;
                this.processes.forEach(p => this.updateProcessStatus(p.id, 'completed', 'Finished'));
                
                document.getElementById('startBtn').disabled = false;
                document.getElementById('startBtn').textContent = '🚀 Start Simulation';
                document.getElementById('startBtn').style.display = 'block';
                
                const stepBtn = document.getElementById('stepBtn');
                stepBtn.textContent = '➡️ Next Step';
                stepBtn.disabled = false;
                
                this.renderMatrix('matrixC', this.matrixC);
            }
        }

        // Info modal functions
        function toggleInfoModal() {
            const modal = document.getElementById('infoModal');
            if (modal.classList.contains('show')) {
                closeInfoModal();
            } else {
                openInfoModal();
            }
        }

        function openInfoModal() {
            const modal = document.getElementById('infoModal');
            modal.classList.add('show');
            document.body.style.overflow = 'hidden';
        }

        function closeInfoModal(event) {
            if (!event || event.target === document.getElementById('infoModal') || event.target.classList.contains('close-button')) {
                const modal = document.getElementById('infoModal');
                modal.classList.remove('show');
                document.body.style.overflow = '';
            }
        }

        // Make modal functions globally available
        window.toggleInfoModal = toggleInfoModal;
        window.openInfoModal = openInfoModal;
        window.closeInfoModal = closeInfoModal;

        document.addEventListener('DOMContentLoaded', () => {
            new MPISimulation();
            
            // Keyboard shortcuts for info modal
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    closeInfoModal();
                    return;
                }
                if (e.key === 'F1' || (e.ctrlKey && e.key === 'h')) {
                    e.preventDefault();
                    toggleInfoModal();
                    return;
                }
            });
        });

        // Mobile orientation handling
        function checkOrientation() {
            const overlay = document.querySelector('.rotate-device-overlay');
            const isMobile = window.innerWidth < 768;
            const isPortrait = window.innerHeight > window.innerWidth;
            
            if (isMobile && isPortrait) {
                overlay.style.display = 'flex';
            } else {
                overlay.style.display = 'none';
            }
        }

        // Check orientation on load and resize
        window.addEventListener('load', checkOrientation);
        window.addEventListener('resize', checkOrientation);
        window.addEventListener('orientationchange', () => {
            setTimeout(checkOrientation, 100);
        });