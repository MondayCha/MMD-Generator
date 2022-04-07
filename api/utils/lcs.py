# https://rosettacode.org/wiki/Longest_common_subsequence#Python
# from api.models.coordinate import Coordinate


def lcs(a, b):
    # generate matrix of length of longest common subsequence for substrings of both words
    len_a, len_b = len(a), len(b)
    lengths = [[0] * (len_b+1) for _ in range(len_a+1)]
    for i, x in enumerate(a):
        for j, y in enumerate(b):
            if x == y:
                lengths[i+1][j+1] = lengths[i][j] + 1
            else:
                lengths[i+1][j+1] = max(lengths[i+1][j], lengths[i][j+1])

    # read a substring from the matrix
    # for i in range(0, len_a + 1):
    #     for j in range(0, len_b +1):
    #         print('%s ' % lengths[i][j], end='')
    #     print()
    
    # read a substring from the matrix
    result = []
    index_a = []
    index_b = []
    i, j = len_a, len_b
    while i > 0 and j > 0:
        if lengths[i][j] == lengths[i][j-1]:
            j -= 1
        elif lengths[i][j] == lengths[i-1][j]:
            i -= 1
        else:
            result.append(a[i-1])
            index_a.append(i-1)
            index_b.append(j-1)
            i -= 1
            j -= 1

    return list(reversed(result)), list(reversed(index_a)), list(reversed(index_b))

